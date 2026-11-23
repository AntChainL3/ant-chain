// Opens gas-credit claims on mainnet:
//   1. ANTcStaking.setRedeemer(REDEEMER_ADDRESS)          (owner = DEPLOYER, on Robinhood Chain)
//   2. a little ETH to the redeemer on Robinhood Chain    (to record claims with spendCredits)
//   3. ANT to the redeemer on ANT CHAIN                    (the gas it hands out)
//   node scripts/08-credits-setup.js --mainnet            asks you to type "deploy mainnet"
// Env: FUND_ETH (default 0.0005), FUND_ANT (default 0.008)
import { createPublicClient, createWalletClient, defineChain, http, parseAbi, parseEther, formatEther } from "viem";
import { NETWORK, S, parentPublicClient as l2, walletClient, account, loadDeployment, confirmMainnet } from "./lib.js";

if (!["mainnet", "testnet"].includes(NETWORK)) throw new Error("Run with --mainnet.");
const dep = loadDeployment();
const STAKING = dep.antcStaking?.address;
if (!STAKING) throw new Error("No staking contract in the deployment file.");
const L3_RPC = process.env.L3_RPC || (NETWORK === "testnet" ? "https://rpc.testnet.antchain.tech" : "https://rpc.antchain.tech");
const l3chain = defineChain({ id: S.chainId, name: S.chainName, nativeCurrency: { name: "ANT", symbol: "ANT", decimals: 18 }, rpcUrls: { default: { http: [L3_RPC] } } });
const l3 = createPublicClient({ chain: l3chain, transport: http(L3_RPC) });
const deployer = account("DEPLOYER");
const redeemer = account("REDEEMER").address;
const dl2 = walletClient("DEPLOYER");
const dl3 = createWalletClient({ account: deployer, chain: l3chain, transport: http(L3_RPC) });
const abi = parseAbi(["function setRedeemer(address)", "function redeemer() view returns (address)", "function owner() view returns (address)"]);
const FUND_ETH = parseEther(process.env.FUND_ETH || "0.0005");
const FUND_ANT = parseEther(process.env.FUND_ANT || "0.008");

const [owner, current, eth, ant] = await Promise.all([
  l2.readContract({ address: STAKING, abi, functionName: "owner" }),
  l2.readContract({ address: STAKING, abi, functionName: "redeemer" }),
  l2.getBalance({ address: redeemer }),
  l3.getBalance({ address: redeemer }),
]);
if (owner.toLowerCase() !== deployer.address.toLowerCase()) throw new Error(`The staking owner is ${owner}, not the deployer.`);
console.log(`staking ${STAKING}\nredeemer now ${current}\nnew redeemer ${redeemer}: ${formatEther(eth)} ETH on Robinhood Chain, ${formatEther(ant)} ANT on ANT CHAIN`);
console.log(`will: setRedeemer, send ${formatEther(FUND_ETH)} ETH (Robinhood Chain) and ${formatEther(FUND_ANT)} ANT (ANT CHAIN) from the deployer`);
await confirmMainnet(`open gas-credit claims: redeemer ${redeemer}, fund ${formatEther(FUND_ETH)} ETH + ${formatEther(FUND_ANT)} ANT`);

const ok = async (client, h, label) => { const r = await client.waitForTransactionReceipt({ hash: h }); if (r.status !== "success") throw new Error(`${label} reverted ${h}`); console.log(`  ${label}: ${h}`); };
if (current.toLowerCase() !== redeemer.toLowerCase()) await ok(l2, await dl2.writeContract({ address: STAKING, abi, functionName: "setRedeemer", args: [redeemer] }), "setRedeemer");
if (eth < FUND_ETH) await ok(l2, await dl2.sendTransaction({ to: redeemer, value: FUND_ETH - eth }), "fund ETH");
if (ant < FUND_ANT) await ok(l3, await dl3.sendTransaction({ to: redeemer, value: FUND_ANT - ant }), "fund ANT");
console.log("done. Redeemer:", redeemer);
