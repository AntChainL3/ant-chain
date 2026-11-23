// Changes the launchpad's settings for NEW tokens (owner only). Tokens already launched keep the settings
// they started with: their graduation target is fixed at launch and cannot be changed by anyone.
//
//   PowerShell:  $env:LAUNCH_TARGET="10000000"; node scripts/09-launchpad-params.js --mainnet
//
// Env (whole tokens / basis points; anything left out keeps its current value):
//   LAUNCH_TARGET      $ANTC a curve raises before it graduates
//   LAUNCH_FEE_BPS     trading fee in basis points (100 = 1%, max 200)
//   LAUNCH_BURN_BPS    share of the fee that is burned, in basis points (5000 = half)
//   LAUNCH_CREATE_FEE  $ANTC to create a token
import { createPublicClient, createWalletClient, defineChain, http, parseAbi, parseEther, formatEther } from "viem";
import { NETWORK, S, account, loadDeployment, confirmMainnet } from "./lib.js";

if (NETWORK !== "mainnet") throw new Error("Run with --mainnet.");
const dep = loadDeployment();
const PAD = dep.launchpad?.address;
if (!PAD) throw new Error("No launchpad in deployment.mainnet.json.");
const RPC = process.env.L3_RPC || "https://rpc.antchain.tech";
const chain = defineChain({ id: S.chainId, name: S.chainName, nativeCurrency: { name: "ANT", symbol: "ANT", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } });
const pub = createPublicClient({ chain, transport: http(RPC) });
const me = account("DEPLOYER");
const wallet = createWalletClient({ account: me, chain, transport: http(RPC) });
const abi = parseAbi([
  "function owner() view returns (address)", "function treasury() view returns (address)",
  "function feeBps() view returns (uint16)", "function burnShareBps() view returns (uint16)",
  "function createFee() view returns (uint256)", "function graduationTarget() view returns (uint256)",
  "function setParams(uint16 feeBps_, uint16 burnShareBps_, uint256 createFee_, uint256 graduationTarget_, address treasury_)",
]);
const read = (f) => pub.readContract({ address: PAD, abi, functionName: f });
const [owner, treasury, feeBps, burnBps, createFee, target] = await Promise.all(["owner", "treasury", "feeBps", "burnShareBps", "createFee", "graduationTarget"].map(read));
if (owner.toLowerCase() !== me.address.toLowerCase()) throw new Error(`The launchpad owner is ${owner}, not the deployer.`);

const plain = (name) => { const v = (process.env[name] || "").trim(); if (v && !/^\d+(\.\d+)?$/.test(v)) throw new Error(`${name}="${v}" must be a plain number (write 10000000, not 10,000,000).`); return v; };
const next = {
  feeBps: plain("LAUNCH_FEE_BPS") ? Number(plain("LAUNCH_FEE_BPS")) : Number(feeBps),
  burnBps: plain("LAUNCH_BURN_BPS") ? Number(plain("LAUNCH_BURN_BPS")) : Number(burnBps),
  createFee: plain("LAUNCH_CREATE_FEE") ? parseEther(plain("LAUNCH_CREATE_FEE")) : createFee,
  target: plain("LAUNCH_TARGET") ? parseEther(plain("LAUNCH_TARGET")) : target,
};
if (next.feeBps > 200 || next.burnBps > 10_000 || next.target < 3000n) throw new Error("Out of range: fee at most 200 bps, burn share at most 10000 bps.");

const row = (label, a, b) => console.log(`  ${label.padEnd(20)} ${String(a).padEnd(22)} -> ${b}${String(a) === String(b) ? "  (unchanged)" : ""}`);
console.log(`launchpad ${PAD} (owner ${owner})\nsettings for NEW tokens:`);
row("graduation target", `${formatEther(target)} $ANTC`, `${formatEther(next.target)} $ANTC`);
row("market cap at grad.", `${formatEther(target * 5n)} $ANTC`, `${formatEther(next.target * 5n)} $ANTC`);
row("trading fee", `${Number(feeBps) / 100}%`, `${next.feeBps / 100}%`);
row("burned share of fee", `${Number(burnBps) / 100}%`, `${next.burnBps / 100}%`);
row("create fee", `${formatEther(createFee)} $ANTC`, `${formatEther(next.createFee)} $ANTC`);
await confirmMainnet(`update launchpad settings for new tokens (target ${formatEther(next.target)} $ANTC)`);
const h = await wallet.writeContract({ address: PAD, abi, functionName: "setParams", args: [next.feeBps, next.burnBps, next.createFee, next.target, treasury] });
const r = await pub.waitForTransactionReceipt({ hash: h });
if (r.status !== "success") throw new Error(`setParams reverted: ${h}`);
console.log(`done: ${h}\nnew graduation target ${formatEther(await read("graduationTarget"))} $ANTC`);
