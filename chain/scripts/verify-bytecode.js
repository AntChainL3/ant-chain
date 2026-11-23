// Checks that every ANT CHAIN contract running on chain is exactly the code in this repository.
//
// It reads the deployed (runtime) bytecode of each contract and compares it with the bytecode compiled
// from this repo's sources (Foundry artifacts in out/, or the official Uniswap V2 builds in node_modules).
// Constructor-set values (immutables) are the only bytes allowed to differ, and they are skipped.
//
//   cd chain && npm ci && forge build && node scripts/verify-bytecode.js
//
// Anyone can run this: it only reads public RPCs and needs no keys.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RPC = { robinhood: process.env.ROBINHOOD_RPC || "https://robinhood.drpc.org", antchain: process.env.ANTCHAIN_RPC || "https://rpc.antchain.tech" };
const dep = JSON.parse(fs.readFileSync(path.join(ROOT, "deployment.mainnet.json"), "utf8"));

const foundry = (file, name) => {
  const a = JSON.parse(fs.readFileSync(path.join(ROOT, "out", file, `${name}.json`), "utf8"));
  return { code: a.deployedBytecode.object, imm: a.deployedBytecode.immutableReferences || {} };
};
const uniswap = (p) => {
  const a = JSON.parse(fs.readFileSync(path.join(ROOT, "node_modules", p), "utf8"));
  return { code: a.evm.deployedBytecode.object, imm: a.evm.deployedBytecode.immutableReferences || {} };
};

const CHECKS = [
  { chain: "robinhood", name: "ANTcStaking ($ANTC staking for gas credits)", address: dep.antcStaking.address, src: "contracts/ANTcStaking.sol", art: () => foundry("ANTcStaking.sol", "ANTcStaking") },
  { chain: "robinhood", name: "AntFeeTokenPricer (ANT fee pricer)", address: dep.feeTokenPricer, src: "contracts/AntFeeTokenPricer.sol", art: () => foundry("AntFeeTokenPricer.sol", "AntFeeTokenPricer") },
  { chain: "antchain", name: "AntcLaunchpad (launchpad)", address: dep.launchpad.address, src: "contracts/AntcLaunchpad.sol", art: () => foundry("AntcLaunchpad.sol", "AntcLaunchpad") },
  { chain: "antchain", name: "WrappedANT (WANT)", address: dep.dex.wrappedAnt, src: "contracts/WrappedANT.sol", art: () => foundry("WrappedANT.sol", "WrappedANT") },
  { chain: "antchain", name: "UniswapV2Factory (exchange)", address: dep.dex.factory, src: "@uniswap/v2-core (official build)", art: () => uniswap("@uniswap/v2-core/build/UniswapV2Factory.json") },
  { chain: "antchain", name: "UniswapV2Router02 (exchange)", address: dep.dex.router, src: "@uniswap/v2-periphery (official build)", art: () => uniswap("@uniswap/v2-periphery/build/UniswapV2Router02.json") },
];

async function getCode(chain, address) {
  const r = await fetch(RPC[chain], { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getCode", params: [address, "latest"] }) });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j.result;
}

// compare byte by byte, skipping the immutable ranges
function compare(onchain, compiled, imm) {
  const a = Buffer.from(onchain.replace(/^0x/, ""), "hex");
  const b = Buffer.from(compiled.replace(/^0x/, ""), "hex");
  if (a.length !== b.length) return { ok: false, why: `length differs (${a.length} on chain vs ${b.length} compiled)` };
  const skip = new Uint8Array(a.length);
  let immBytes = 0;
  for (const refs of Object.values(imm)) for (const { start, length } of refs) { skip.fill(1, start, start + length); immBytes += length; }
  for (let i = 0; i < a.length; i++) if (!skip[i] && a[i] !== b[i]) return { ok: false, why: `first difference at byte ${i}` };
  return { ok: true, bytes: a.length, immBytes };
}

let failed = 0;
for (const c of CHECKS) {
  try {
    const onchain = await getCode(c.chain, c.address);
    if (!onchain || onchain === "0x") throw new Error("no code at this address");
    const { code, imm } = c.art();
    const r = compare(onchain, code, imm);
    if (!r.ok) failed++;
    console.log(`${r.ok ? "MATCH   " : "MISMATCH"}  ${c.name}\n          ${c.chain === "robinhood" ? "Robinhood Chain" : "ANT CHAIN"} ${c.address}\n          source ${c.src}${r.ok ? ` · ${r.bytes} bytes, ${r.immBytes} constructor-set bytes skipped` : ` · ${r.why}`}`);
  } catch (e) {
    failed++;
    console.log(`ERROR     ${c.name} ${c.address}: ${e.message}`);
  }
}
console.log(failed ? `\n${failed} contract(s) did not match.` : `\nAll ${CHECKS.length} contracts match the source in this repository.`);
process.exit(failed ? 1 : 0);
