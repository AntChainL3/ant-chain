// Deploys the ANT CHAIN launchpad (AntcLaunchpad), where every trade is paid in $ANTC.
//
//   node scripts/07-launchpad.js --testnet    deploys Test ANTC (tANTC, public faucet) + the launchpad on
//                                              ANT CHAIN Testnet, then runs a create / buy / sell smoke test
//   node scripts/07-launchpad.js --mainnet    deploys the launchpad on ANT CHAIN with $ANTC as the quote token
//                                              (needs LAUNCH_TARGET; asks you to type "deploy mainnet")
//
// On mainnet the quote token is $ANTC bridged through the standard token gateway. Its ANT CHAIN address is
// fixed by the gateway (calculateL2TokenAddress) and exists once the first $ANTC has been bridged in.
// Env: LAUNCH_TARGET  $ANTC a curve raises before it graduates (whole tokens; testnet default 200000)
//      LAUNCH_CREATE_FEE  $ANTC to create a token (whole tokens, default 0)
import fs from "node:fs";
import path from "node:path";
import { createPublicClient, createWalletClient, defineChain, http, parseAbi, parseEther, formatEther, getAddress, maxUint256 } from "viem";
import { ROOT, NETWORK, S, account, loadDeployment, saveDeployment, confirmMainnet, parentPublicClient } from "./lib.js";

if (!["mainnet", "testnet"].includes(NETWORK)) throw new Error("Run with --testnet or --mainnet.");
const TESTNET = NETWORK === "testnet";
const L3_RPC = process.env.L3_RPC || (TESTNET ? "https://rpc.testnet.antchain.tech" : "https://rpc.antchain.tech");
const ANTC_ON_ROBINHOOD = "0x1A9ca5A347c4aeAb4870668E76506E45C23D6281";

const dep = loadDeployment();
if (dep.launchpad) { console.log("Launchpad already deployed:", dep.launchpad); process.exit(0); }
if (!dep.dex?.factory) throw new Error("Deploy the exchange first (scripts/05-dex.js).");

const art = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const PAD = art("out/AntcLaunchpad.sol/AntcLaunchpad.json");
const TANTC = art("out/TestANTC.sol/TestANTC.json");
const chain = defineChain({ id: S.chainId, name: S.chainName, nativeCurrency: { name: "ANT", symbol: "ANT", decimals: 18 }, rpcUrls: { default: { http: [L3_RPC] } } });
const pub = createPublicClient({ chain, transport: http(L3_RPC, { timeout: 60_000 }) });
const me = account("DEPLOYER");
const wallet = createWalletClient({ account: me, chain, transport: http(L3_RPC, { timeout: 60_000 }) });

async function deploy(label, a, args = []) {
  const hash = await wallet.deployContract({ abi: a.abi, bytecode: a.bytecode.object, args });
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`${label} deploy failed: ${hash}`);
  console.log(`  ${label}: ${r.contractAddress} (${hash})`);
  return getAddress(r.contractAddress);
}
async function send(label, req) {
  const hash = await wallet.writeContract(req);
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`${label} failed: ${hash}`);
  console.log(`  ${label}: ${hash}`);
  return r;
}

const target = parseEther(process.env.LAUNCH_TARGET || (TESTNET ? "200000" : ""));
if (!target) throw new Error("Set LAUNCH_TARGET (whole $ANTC a curve raises before it graduates).");
const createFee = parseEther(process.env.LAUNCH_CREATE_FEE || "0");
console.log(`deployer ${me.address} on ${S.chainName}: ${formatEther(await pub.getBalance({ address: me.address }))} ANT`);

let quote;
if (TESTNET) {
  quote = null; // deployed below
} else {
  const routerAbi = parseAbi(["function calculateL2TokenAddress(address) view returns (address)"]);
  quote = getAddress(await parentPublicClient.readContract({ address: dep.tokenBridge.parentChainContracts.router, abi: routerAbi, functionName: "calculateL2TokenAddress", args: [ANTC_ON_ROBINHOOD] }));
  console.log(`$ANTC on ANT CHAIN (standard gateway): ${quote}`);
}
console.log(`graduation target ${formatEther(target)} ${TESTNET ? "tANTC" : "$ANTC"}, create fee ${formatEther(createFee)}, treasury and owner ${me.address}`);
await confirmMainnet(`deploy AntcLaunchpad on ANT CHAIN (quote ${quote}, target ${formatEther(target)} $ANTC)`);

if (TESTNET) quote = await deploy("TestANTC", TANTC);
const pad = await deploy("AntcLaunchpad", PAD, [quote, dep.dex.factory, me.address, target, me.address]);
if (createFee > 0n) await send("setParams", { address: pad, abi: PAD.abi, functionName: "setParams", args: [100, 5000, createFee, target, me.address] });
saveDeployment({ launchpad: { address: pad, quote, factory: dep.dex.factory, target: target.toString(), deployedAt: new Date().toISOString(), ...(TESTNET ? { testAntc: quote } : {}) } });

if (TESTNET) {
  // smoke test: faucet, create with a first buy, buy, sell
  const erc = parseAbi(["function drip()", "function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"]);
  await send("tANTC drip", { address: quote, abi: erc, functionName: "drip" });
  await send("approve", { address: quote, abi: erc, functionName: "approve", args: [pad, maxUint256] });
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  const r = await send("create TEST + buy 1,000", { address: pad, abi: PAD.abi, functionName: "create", args: ["ANT CHAIN Test", "ACTEST", '{"description":"Smoke test token for the ANT CHAIN launchpad on testnet."}', parseEther("1000"), 1n, deadline] });
  const token = (await pub.readContract({ address: pad, abi: PAD.abi, functionName: "tokensPage", args: [0n, 1n] }))[0];
  console.log(`  token ${token}, holding ${formatEther(await pub.readContract({ address: token, abi: erc, functionName: "balanceOf", args: [me.address] }))}`);
  await send("buy 2,000", { address: pad, abi: PAD.abi, functionName: "buy", args: [token, parseEther("2000"), 1n, deadline] });
  const held = await pub.readContract({ address: token, abi: erc, functionName: "balanceOf", args: [me.address] });
  await send("approve token", { address: token, abi: erc, functionName: "approve", args: [pad, held] });
  await send("sell half", { address: pad, abi: PAD.abi, functionName: "sell", args: [token, held / 2n, 1n, deadline] });
  console.log(`  price now ${formatEther(await pub.readContract({ address: pad, abi: PAD.abi, functionName: "priceOf", args: [token] }))} tANTC per token`);
  void r;
}
console.log("done:", pad);
