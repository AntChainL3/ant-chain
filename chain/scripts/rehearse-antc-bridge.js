// Rehearses bridging $ANTC from Robinhood Chain into ANT CHAIN on a local Anvil fork of Robinhood Chain mainnet,
// exactly as the website does it: approve $ANTC and the ANT fee to the standard gateway, then call
// L1OrbitGatewayRouter.outboundTransferCustomRefund with (maxSubmissionCost = 0, no hook data, fee in ANT).
// Nothing is sent to the real chain.
//   node scripts/rehearse-antc-bridge.js
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { createPublicClient, createTestClient, createWalletClient, http, parseAbi, parseEther, formatEther, encodeAbiParameters, decodeEventLog, parseAbiItem } from "viem";

const ANVIL = process.env.ANVIL_BIN || path.join(os.homedir(), ".foundry", "bin", process.platform === "win32" ? "anvil.exe" : "anvil");
const UPSTREAM = process.env.PARENT_RPC || "https://robinhood.drpc.org";
const FORK = "http://127.0.0.1:8547";
const ANTC = "0x1A9ca5A347c4aeAb4870668E76506E45C23D6281";
const ANT = "0xbbB6c29bCc3a1028A2B54310DF73F4F7A3bcB373";
const ROUTER = "0xCFe1612bA1Fb5c98a6Aaed86c69cE3aE7f632228";
const GATEWAY = "0x13Cb5e46C2758057582d27760DDC5052FaDC27c8";
const ANT_HOLDER = "0x3c7218E4E7a0819C3C83065d030BB3502AE76F1a"; // ANT CHAIN bridge escrow (fork only: lends test ANT)
const USER = "0x00000000000000000000000000000000000bEEF1";

const anvil = spawn(ANVIL, ["--fork-url", UPSTREAM, "--port", "8547", "--silent", "--chain-id", "4663"], { stdio: "ignore" });
const stop = () => { try { anvil.kill(); } catch {} };
process.on("exit", stop);
for (let i = 0; i < 80; i++) { try { await fetch(FORK, { method: "POST", headers: { "content-type": "application/json" }, body: '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' }); break; } catch { await new Promise((r) => setTimeout(r, 500)); } }

const chain = { id: 4663, name: "rh-fork", nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [FORK] } } };
const pub = createPublicClient({ chain, transport: http(FORK) });
const test = createTestClient({ chain, mode: "anvil", transport: http(FORK) });
const erc = parseAbi(["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)", "function transfer(address,uint256) returns (bool)"]);
const routerAbi = parseAbi(["function outboundTransferCustomRefund(address _token, address _refundTo, address _to, uint256 _amount, uint256 _maxGas, uint256 _gasPriceBid, bytes _data) payable returns (bytes)", "function getGateway(address) view returns (address)"]);

async function as(addr, req) {
  await test.impersonateAccount({ address: addr });
  await test.setBalance({ address: addr, value: parseEther("1") });
  const w = createWalletClient({ account: addr, chain, transport: http(FORK) });
  const h = await w.writeContract(req);
  const r = await pub.waitForTransactionReceipt({ hash: h });
  if (r.status !== "success") throw new Error("reverted: " + h);
  return r;
}

console.log("gateway for $ANTC:", await pub.readContract({ address: ROUTER, abi: routerAbi, functionName: "getGateway", args: [ANTC] }));

// fork only: give the test user 1,000 $ANTC
const amount = parseEther("1000");
await test.request({ method: "anvil_dealERC20", params: [USER, ANTC, `0x${amount.toString(16)}`] });
console.log("test user $ANTC:", formatEther(await pub.readContract({ address: ANTC, abi: erc, functionName: "balanceOf", args: [USER] })));
await as(ANT_HOLDER, { address: ANT, abi: erc, functionName: "transfer", args: [USER, parseEther("0.01")] });

const maxGas = 2_000_000n, gasPriceBid = 200_000_000n; // 0.2 gwei, 2x ANT CHAIN's price
const fee = maxGas * gasPriceBid;
await as(USER, { address: ANTC, abi: erc, functionName: "approve", args: [GATEWAY, amount] });
await as(USER, { address: ANT, abi: erc, functionName: "approve", args: [GATEWAY, fee] });
const data = encodeAbiParameters([{ type: "uint256" }, { type: "bytes" }, { type: "uint256" }], [0n, "0x", fee]);
const antBefore = await pub.readContract({ address: ANT, abi: erc, functionName: "balanceOf", args: [USER] });
const r = await as(USER, { address: ROUTER, abi: routerAbi, functionName: "outboundTransferCustomRefund", args: [ANTC, USER, USER, amount, maxGas, gasPriceBid, data] });
const antAfter = await pub.readContract({ address: ANT, abi: erc, functionName: "balanceOf", args: [USER] });
const escrow = await pub.readContract({ address: ANTC, abi: erc, functionName: "balanceOf", args: [GATEWAY] });
const DepositInitiated = parseAbiItem("event DepositInitiated(address l1Token, address indexed _from, address indexed _to, uint256 indexed _sequenceNumber, uint256 _amount)");
let ok = false;
for (const lg of r.logs) { try { const e = decodeEventLog({ abi: [DepositInitiated], data: lg.data, topics: lg.topics }); console.log("DepositInitiated", e.args); ok = true; } catch {} }
console.log(`ANT fee paid: ${formatEther(antBefore - antAfter)} (expected ${formatEther(fee)}); $ANTC in gateway escrow: ${formatEther(escrow)}; gas ${r.gasUsed}`);
if (!ok) throw new Error("no DepositInitiated event");
console.log("REHEARSAL PASSED");
stop();
process.exit(0);
