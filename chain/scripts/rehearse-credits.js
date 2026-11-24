// Testnet rehearsal of the gas-credits service (scripts/credits.js), end to end:
// set the redeemer, fund it, stake tANT from a throwaway wallet, wait for credits, claim with a
// signed message, then check: credits spent on Robinhood Chain Testnet, gas received on ANT CHAIN Testnet,
// a second claim is refused, a forged signature is refused.
//   node scripts/rehearse-credits.js --testnet
import { spawn } from "node:child_process";
import path from "node:path";
import { createPublicClient, createWalletClient, defineChain, http, parseAbi, parseEther, formatEther, maxUint256 } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { NETWORK, ROOT, S, parentPublicClient as l2, walletClient, account, loadDeployment } from "./lib.js";

if (NETWORK !== "testnet") throw new Error("Testnet only.");
const dep = loadDeployment();
const STAKING = dep.antcStaking.address, TANT = dep.nativeToken;
const L3_RPC = "https://rpc.testnet.antchain.tech";
const l3chain = defineChain({ id: S.chainId, name: S.chainName, nativeCurrency: { name: "tANT", symbol: "tANT", decimals: 18 }, rpcUrls: { default: { http: [L3_RPC] } } });
const l3 = createPublicClient({ chain: l3chain, transport: http(L3_RPC) });
const deployer = account("DEPLOYER"), redeemer = account("REDEEMER");
const dl2 = walletClient("DEPLOYER");
const dl3 = createWalletClient({ account: deployer, chain: l3chain, transport: http(L3_RPC) });
const stakingAbi = parseAbi(["function setRedeemer(address)", "function redeemer() view returns (address)", "function stake(uint256)", "function creditsOf(address) view returns (uint256)", "function spentOf(address) view returns (uint256)"]);
const erc = parseAbi(["function drip()", "function approve(address,uint256) returns (bool)", "function transfer(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"]);
const wait2 = async (h) => { const r = await l2.waitForTransactionReceipt({ hash: h }); if (r.status !== "success") throw new Error("reverted " + h); return r; };
const wait3 = async (h) => { const r = await l3.waitForTransactionReceipt({ hash: h }); if (r.status !== "success") throw new Error("reverted " + h); return r; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// one line per check; control characters are stripped so nothing in a label can forge extra log lines
const check = (ok, label) => { console.log(`${ok ? "PASS" : "FAIL"}  ${String(label).replace(/[\r\n\u2028\u2029]+/g, " ")}`); if (!ok) process.exitCode = 1; };

// 1. redeemer role + funding
if ((await l2.readContract({ address: STAKING, abi: stakingAbi, functionName: "redeemer" })).toLowerCase() !== redeemer.address.toLowerCase()) {
  await wait2(await dl2.writeContract({ address: STAKING, abi: stakingAbi, functionName: "setRedeemer", args: [redeemer.address] }));
  console.log("redeemer set to", redeemer.address);
}
if ((await l2.getBalance({ address: redeemer.address })) < parseEther("0.0001")) await wait2(await dl2.sendTransaction({ to: redeemer.address, value: parseEther("0.0002") }));
if ((await l3.getBalance({ address: redeemer.address })) < parseEther("1")) await wait3(await dl3.sendTransaction({ to: redeemer.address, value: parseEther("2") }));

// 2. a throwaway staker
const user = privateKeyToAccount(generatePrivateKey());
const ul2 = createWalletClient({ account: user, chain: S.parentChain, transport: http(S.rpc) });
await wait2(await dl2.sendTransaction({ to: user.address, value: parseEther("0.0001") }));
await wait2(await ul2.writeContract({ address: TANT, abi: erc, functionName: "drip" }));
await wait2(await ul2.writeContract({ address: TANT, abi: erc, functionName: "approve", args: [STAKING, maxUint256] }));
await wait2(await ul2.writeContract({ address: STAKING, abi: stakingAbi, functionName: "stake", args: [parseEther("100")] }));
console.log("staker", user.address, "staked 100 tANT; waiting for credits…");
for (;;) { const c = await l2.readContract({ address: STAKING, abi: stakingAbi, functionName: "creditsOf", args: [user.address] }); if (c >= parseEther("0.12")) { console.log("credits", formatEther(c)); break; } await sleep(15000); }

// 3. run the service locally
const port = 8791;
const svc = spawn(process.execPath, [path.join(ROOT, "scripts", "credits.js"), "--testnet"], { env: { ...process.env, PORT: String(port), CREDITS_PER_CLAIM: "0.1", GAS_PER_CLAIM: "0.01" }, stdio: ["ignore", "pipe", "pipe"] });
svc.stdout.on("data", (d) => process.stdout.write("  [svc] " + d));
svc.stderr.on("data", (d) => process.stdout.write("  [svc!] " + d));
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 40; i++) { try { await fetch(base + "/info"); break; } catch { await sleep(500); } }
const info = await (await fetch(base + "/info")).json();
check(info.open === true, `service open (${JSON.stringify(info)})`);

const post = async (body) => { const r = await fetch(base + "/claim", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; };
const msgFor = (a) => `ANT CHAIN gas claim\nAddress: ${a}\nChain: ${S.chainId}\nIssued: ${new Date().toISOString()}`;

// forged: signed by someone else
const other = privateKeyToAccount(generatePrivateKey());
const m0 = msgFor(user.address);
const forged = await post({ address: user.address, message: m0, signature: await other.signMessage({ message: m0 }) });
check(forged.status === 401, `forged signature refused (${forged.status})`);

const before = await l3.getBalance({ address: user.address });
const spentBefore = await l2.readContract({ address: STAKING, abi: stakingAbi, functionName: "spentOf", args: [user.address] });
const m1 = msgFor(user.address);
const ok = await post({ address: user.address, message: m1, signature: await user.signMessage({ message: m1 }) });
check(ok.status === 200 && ok.body.gasTx, `claim accepted (${ok.status} ${JSON.stringify(ok.body)})`);
const after = await l3.getBalance({ address: user.address });
const spentAfter = await l2.readContract({ address: STAKING, abi: stakingAbi, functionName: "spentOf", args: [user.address] });
check(after - before === parseEther("0.01"), `gas received on ANT CHAIN: ${formatEther(after - before)} tANT`);
check(spentAfter - spentBefore === parseEther("0.1"), `credits recorded as spent on chain: ${formatEther(spentAfter - spentBefore)}`);

const m2 = msgFor(user.address);
const again = await post({ address: user.address, message: m2, signature: await user.signMessage({ message: m2 }) });
check(again.status === 429, `second claim today refused (${again.status} ${again.body.error})`);

svc.kill();
console.log(process.exitCode ? "REHEARSAL FAILED" : "REHEARSAL PASSED");
process.exit(process.exitCode || 0);
