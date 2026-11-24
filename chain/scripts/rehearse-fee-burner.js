// Rehearses the exchange fee burn on a local Anvil fork of ANT CHAIN mainnet. Nothing is sent to the real chain.
//   1. runs scripts/10-fee-burner.js against the fork (deploy FeeBurner, turn on the fee switch)
//   2. trades on the real pools (ANT/$ANTC, SHOGGOTH/$ANTC, SHOGGOTH/ANT) and adds liquidity so the fee is minted
//   3. launches a token on the real launchpad and buys it to graduation, with the fee switch on
//   4. runs the keeper's burn job as the keeper, twice
//   5. checks: $ANTC reached 0xdEaD and matches totalBurned, the FeeBurner is left empty, the keeper got nothing
//   node scripts/rehearse-fee-burner.js
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { createPublicClient, createTestClient, createWalletClient, http, parseAbi, parseEther, formatEther, getAddress, maxUint256 } from "viem";
import { createBurnerJob } from "./fee-burner-job.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
config({ path: path.resolve(ROOT, "..", ".env.mainnet"), quiet: true });
const dep = (await import("node:fs")).readFileSync(path.join(ROOT, "deployment.mainnet.json"), "utf8");
const D = JSON.parse(dep);

const ANVIL = process.env.ANVIL_BIN || path.join(os.homedir(), ".foundry", "bin", process.platform === "win32" ? "anvil.exe" : "anvil");
const PORT = "8548";
const FORK = `http://127.0.0.1:${PORT}`;
const DEAD = "0x000000000000000000000000000000000000dEaD";
const ANTC = getAddress(D.launchpad.quote), WANT = getAddress(D.dex.wrappedAnt), ROUTER = getAddress(D.dex.router), FACTORY = getAddress(D.dex.factory), PAD = getAddress(D.launchpad.address);
const SHOG_ANTC_POOL = "0xFdb1Bb454F2114BFBBEA620B18DdFDc44Bf13624"; // the first token that graduated on the launchpad
const TRADER = "0x00000000000000000000000000000000000bEEF2";
const KEEPER = getAddress(process.env.KEEPER_ADDRESS);
const DEPLOYER = getAddress(process.env.DEPLOYER_ADDRESS || "0x032c47Ff69165F2723BE277A8049Dc9308c8f838");

const anvil = spawn(ANVIL, ["--fork-url", "https://rpc.antchain.tech", "--port", PORT, "--silent", "--chain-id", "26800", "--base-fee", "100000000", "--gas-price", "100000000"], { stdio: "ignore" });
const stop = () => { try { anvil.kill(); } catch { /* already gone */ } };
process.on("exit", stop);
for (let i = 0; i < 120; i++) { try { await fetch(FORK, { method: "POST", headers: { "content-type": "application/json" }, body: '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' }); break; } catch { await new Promise((r) => setTimeout(r, 500)); } }

const chain = { id: 26800, name: "antchain-fork", nativeCurrency: { name: "ANT", symbol: "ANT", decimals: 18 }, rpcUrls: { default: { http: [FORK] } } };
const pub = createPublicClient({ chain, transport: http(FORK, { timeout: 120_000 }) });
const test = createTestClient({ chain, mode: "anvil", transport: http(FORK) });
const erc = parseAbi(["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)", "function symbol() view returns (string)"]);
const routerAbi = parseAbi([
  "function swapExactTokensForTokens(uint256,uint256,address[],address,uint256) returns (uint256[])",
  "function addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256) returns (uint256,uint256,uint256)",
  "function getAmountsOut(uint256,address[]) view returns (uint256[])",
]);
const factoryAbi = parseAbi(["function getPair(address,address) view returns (address)", "function feeTo() view returns (address)"]);
const padAbi = parseAbi(["function create(string,string,string,uint256,uint256,uint256) returns (address,uint256)", "function buy(address,uint256,uint256,uint256) returns (uint256)", "function tokensPage(uint256,uint256) view returns (address[])", "function tokenCount() view returns (uint256)", "function launches(address) view returns (address,uint96,uint256,uint256,uint256,uint256,uint256,address,bool)"]);
const wantAbi = parseAbi(["function deposit() payable"]);
const poolAbi = parseAbi(["function token0() view returns (address)", "function token1() view returns (address)"]);
const [p0, p1] = await Promise.all(["token0", "token1"].map((fn) => pub.readContract({ address: SHOG_ANTC_POOL, abi: poolAbi, functionName: fn })));
const SHOG = getAddress(p0 === ANTC ? p1 : p0);
if ((await pub.readContract({ address: SHOG, abi: parseAbi(["function symbol() view returns (string)"]), functionName: "symbol" })) !== "SHOGGOTH") throw new Error(`expected SHOGGOTH at ${SHOG}`);

let failed = 0;
const check = (ok, label) => { console.log(`${ok ? "PASS" : "FAIL"}  ${String(label).replace(/[\r\n\u2028\u2029]+/g, " ")}`); if (!ok) failed++; };
const deadline = () => BigInt(Math.floor(Date.now() / 1000) + 3600);

async function as(addr, req) {
  await test.impersonateAccount({ address: addr });
  const w = createWalletClient({ account: addr, chain, transport: http(FORK) });
  if (req.functionName) await pub.simulateContract({ account: addr, ...req }); // surfaces the revert reason
  const h = req.bytecode ? await w.deployContract(req) : req.to ? await w.sendTransaction(req) : await w.writeContract(req);
  const r = await pub.waitForTransactionReceipt({ hash: h });
  if (r.status !== "success") throw new Error(`reverted: ${req.functionName || (req.bytecode ? "deploy" : "send")} on ${req.address || req.to} from ${addr}: ${h}`);
  return r;
}

// ---------- 1. deploy through the real script ----------
await test.setBalance({ address: DEPLOYER, value: parseEther("1") });
const out = await new Promise((resolve, reject) => {
  const p = spawn(process.execPath, [path.join(ROOT, "scripts", "10-fee-burner.js"), "--mainnet"], { cwd: ROOT, env: { ...process.env, L3_RPC: FORK }, stdio: ["ignore", "pipe", "pipe"] });
  let s = "";
  p.stdout.on("data", (d) => { s += d; process.stdout.write("  [deploy] " + d); });
  p.stderr.on("data", (d) => process.stdout.write("  [deploy!] " + d));
  p.on("exit", (code) => (code === 0 ? resolve(s) : reject(new Error("deploy script failed"))));
});
const rec = JSON.parse(out.split("\n").find((l) => l.startsWith('{"rehearsalFeeBurner"'))).rehearsalFeeBurner;
const BURNER = getAddress(rec.address);
check(getAddress(await pub.readContract({ address: FACTORY, abi: factoryAbi, functionName: "feeTo" })) === BURNER, "fee switch points at the FeeBurner");

// ---------- 2. trade on the real pools ----------
await test.setBalance({ address: TRADER, value: parseEther("100") });
await as(TRADER, { address: WANT, abi: wantAbi, functionName: "deposit", value: parseEther("50") });
// test $ANTC: minted by the ANT CHAIN standard gateway (fork only), the way a bridge deposit mints it
const L3_GATEWAY = getAddress(D.tokenBridge.orbitChainContracts.standardGateway);
await test.setBalance({ address: L3_GATEWAY, value: parseEther("1") });
await as(L3_GATEWAY, { address: ANTC, abi: parseAbi(["function bridgeMint(address,uint256)"]), functionName: "bridgeMint", args: [TRADER, parseEther("100000000")] });
for (const t of [ANTC, WANT, SHOG]) await as(TRADER, { address: t, abi: erc, functionName: "approve", args: [ROUTER, maxUint256] });
const swap = (a, b, x) => as(TRADER, { address: ROUTER, abi: routerAbi, functionName: "swapExactTokensForTokens", args: [x, 0n, [a, b], TRADER, deadline()] });
await swap(ANTC, SHOG, parseEther("100000")); // test SHOGGOTH, bought on its pool
const bal = (t, w) => pub.readContract({ address: t, abi: erc, functionName: "balanceOf", args: [w] });
async function volume(a, b, x, rounds) {
  for (let i = 0; i < rounds; i++) {
    const before = await bal(b, TRADER);
    await swap(a, b, x);
    await swap(b, a, (await bal(b, TRADER)) - before);
  }
  // a small deposit is a liquidity event: it mints the fee earned so far to the FeeBurner
  const [, q] = await pub.readContract({ address: ROUTER, abi: routerAbi, functionName: "getAmountsOut", args: [x / 100n, [a, b]] });
  await as(TRADER, { address: ROUTER, abi: routerAbi, functionName: "addLiquidity", args: [a, b, x / 100n, q * 2n, 0n, 0n, TRADER, deadline()] });
}
// first liquidity event after the switch only records kLast; trade, then the next event mints the fee
await volume(WANT, ANTC, parseEther("0.001"), 1);
await volume(SHOG, ANTC, parseEther("100000"), 1);
await volume(SHOG, WANT, parseEther("100000"), 1);
// deeper pools first, like a real liquidity provider would add, so the trades below are realistic
async function deepen(a, b, x) {
  const [, q] = await pub.readContract({ address: ROUTER, abi: routerAbi, functionName: "getAmountsOut", args: [x, [a, b]] });
  await as(TRADER, { address: ROUTER, abi: routerAbi, functionName: "addLiquidity", args: [a, b, x, q * 2n, 0n, 0n, TRADER, deadline()] });
}
await deepen(WANT, ANTC, parseEther("10"));
await swap(ANTC, SHOG, parseEther("5000000"));
await deepen(SHOG, WANT, parseEther("20000000"));
// about 40 ANT of volume across the three pools
await volume(WANT, ANTC, parseEther("1"), 10);
await volume(SHOG, ANTC, parseEther("10000000"), 6);
await volume(SHOG, WANT, parseEther("10000000"), 6);
for (const [a, b, n] of [[WANT, ANTC, "ANT/$ANTC"], [SHOG, ANTC, "SHOGGOTH/$ANTC"], [SHOG, WANT, "SHOGGOTH/ANT"]]) {
  const pair = await pub.readContract({ address: FACTORY, abi: factoryAbi, functionName: "getPair", args: [a, b] });
  check((await bal(pair, BURNER)) > 0n, `fee minted to the FeeBurner on ${n}`);
}

// ---------- 3. launchpad still works and graduates with the fee on ----------
await as(TRADER, { address: ANTC, abi: erc, functionName: "approve", args: [PAD, maxUint256] });
const createReq = { address: PAD, abi: padAbi, functionName: "create", args: ["Fee Rehearsal", "FEER", "{}", 0n, 0n, deadline()] };
const { result: [token] } = await pub.simulateContract({ account: TRADER, ...createReq });
await as(TRADER, createReq);
await as(TRADER, { address: PAD, abi: padAbi, functionName: "buy", args: [token, parseEther("60000000"), 0n, deadline()] });
const launch = await pub.readContract({ address: PAD, abi: padAbi, functionName: "launches", args: [token] });
check(launch[8] === true, `new launch ${token} graduates with the fee switch on`);

// ---------- 4. the keeper's job, as the keeper ----------
await test.setBalance({ address: KEEPER, value: parseEther("0.001") });
await test.impersonateAccount({ address: KEEPER });
const keeperWallet = createWalletClient({ account: KEEPER, chain, transport: http(FORK) });
const keeperBefore = { antc: await bal(ANTC, KEEPER), want: await bal(WANT, KEEPER), shog: await bal(SHOG, KEEPER) };
const deadBefore = await bal(ANTC, DEAD);
const log = (msg, extra = {}) => console.log("  [job]", msg, JSON.stringify(extra));
const job = createBurnerJob({ pub, wallet: keeperWallet, addr: { burner: BURNER, factory: FACTORY, router: ROUTER, antc: ANTC, want: WANT }, log });
const burned1 = await job.run();
check(job.status.lastError === null, `first run without errors (${JSON.stringify(job.status.lastError)})`);
check(burned1 > 0n, `first run burned ${formatEther(burned1)} $ANTC`);
const burned2 = await job.run();
check(job.status.lastError === null, "second run without errors");
const deadAfter = await bal(ANTC, DEAD);
const total = await pub.readContract({ address: BURNER, abi: parseAbi(["function totalBurned() view returns (uint256)"]), functionName: "totalBurned" });
check(deadAfter - deadBefore === total, `0xdEaD received exactly totalBurned (${formatEther(total)} $ANTC)`);
check(burned1 + burned2 === total, "job's own count matches the contract");
// anything left is only what is not yet worth the gas: it waits for a later run
const DUST_ANT = parseEther("0.0001");
const inAnt = async (t, x) => (x === 0n ? 0n : t === WANT ? x : (await pub.readContract({ address: ROUTER, abi: routerAbi, functionName: "getAmountsOut", args: [x, [t, WANT]] }))[1]);
for (const [t, n] of [[WANT, "WANT"], [SHOG, "SHOGGOTH"], [ANTC, "$ANTC"]]) {
  const left = await bal(t, BURNER);
  const v = await inAnt(t, left);
  check(v < DUST_ANT, `FeeBurner keeps only dust of ${n} (${formatEther(left)}, worth ${formatEther(v)} ANT)`);
}
for (const [a, b, n] of [[WANT, ANTC, "ANT/$ANTC"], [SHOG, ANTC, "SHOGGOTH/$ANTC"], [SHOG, WANT, "SHOGGOTH/ANT"]]) {
  const pair = await pub.readContract({ address: FACTORY, abi: factoryAbi, functionName: "getPair", args: [a, b] });
  const lp = await bal(pair, BURNER);
  check(lp === 0n || job.status.lastError === null, `pool shares on ${n}: ${formatEther(lp)} left (unwound, or waiting for enough fee)`);
}
check((await bal(ANTC, KEEPER)) === keeperBefore.antc && (await bal(WANT, KEEPER)) === keeperBefore.want && (await bal(SHOG, KEEPER)) === keeperBefore.shog, "the keeper received nothing");

console.log(failed ? `REHEARSAL FAILED (${failed})` : "REHEARSAL PASSED");
stop();
process.exit(failed ? 1 : 0);
