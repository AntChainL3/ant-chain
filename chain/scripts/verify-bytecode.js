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
  { chain: "antchain", name: "FeeBurner (exchange fee -> burned $ANTC)", address: dep.feeBurner.address, src: "contracts/FeeBurner.sol", art: () => foundry("FeeBurner.sol", "FeeBurner") },
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

// The compiler appends a CBOR metadata block (a hash of the build settings and file paths) to the code;
// its length is in the last two bytes. It is not executed, and it changes with the build machine's folder
// layout, so like block-explorer verifiers we report it separately: "exact" = code + metadata identical,
// "code" = every executed byte identical, only the build metadata differs.
// A contract that creates other contracts (the launchpad creates LaunchTokens) carries their code, and their
// metadata blocks, inside its own. So every metadata hash is located by its CBOR marker {"ipfs": <34 bytes>}
// and set aside, wherever it sits; every other byte must be identical.
const IPFS_KEY = Buffer.from("a2646970667358", "hex"); // CBOR map(2), text "ipfs", bytes(34)
function metadataHashes(buf) {
  const out = [];
  for (let i = buf.indexOf(IPFS_KEY); i !== -1; i = buf.indexOf(IPFS_KEY, i + 1)) {
    if (buf[i + 7] === 0x22) out.push([i + 8, i + 8 + 34]); // 0x22 = length 34: multihash 0x1220 + sha256
  }
  return out;
}

// compare byte by byte, skipping the immutable ranges; metadata hashes decide only exact vs code match
function compare(onchain, compiled, imm) {
  const a = Buffer.from(onchain.replace(/^0x/, ""), "hex");
  const b = Buffer.from(compiled.replace(/^0x/, ""), "hex");
  if (a.length !== b.length) return { ok: false, why: `length differs (${a.length} on chain vs ${b.length} compiled)` };
  const skip = new Uint8Array(a.length);
  let immBytes = 0;
  for (const refs of Object.values(imm)) for (const { start, length } of refs) { skip.fill(1, start, start + length); immBytes += length; }
  const metaA = metadataHashes(a), metaB = metadataHashes(b);
  if (JSON.stringify(metaA) !== JSON.stringify(metaB)) return { ok: false, why: "metadata blocks sit in different places" };
  const meta = new Uint8Array(a.length);
  for (const [s, e] of metaA) meta.fill(1, s, e);
  for (let i = 0; i < a.length; i++) if (!skip[i] && !meta[i] && a[i] !== b[i]) return { ok: false, why: `executed code differs at byte ${i}` };
  const exact = metaA.every(([s, e]) => a.subarray(s, e).equals(b.subarray(s, e)));
  return { ok: true, exact, bytes: a.length, immBytes };
}

// Self-test: the check must catch a single changed executed byte (proves it is not a rubber stamp).
{
  const { code, imm } = CHECKS[2].art(); // the launchpad: immutables and a nested metadata block
  const buf = Buffer.from(code.replace(/^0x/, ""), "hex");
  const i = 100; // inside executed code, before any metadata or immutable
  const tampered = Buffer.from(buf); tampered[i] ^= 0xff;
  const r = compare("0x" + tampered.toString("hex"), code, imm);
  if (r.ok) { console.log("SELF-TEST FAILED: a changed byte was not detected"); process.exit(1); }
  console.log(`self-test: a single changed byte is detected (${r.why})\n`);
}

let failed = 0;
for (const c of CHECKS) {
  try {
    const onchain = await getCode(c.chain, c.address);
    if (!onchain || onchain === "0x") throw new Error("no code at this address");
    const { code, imm } = c.art();
    const r = compare(onchain, code, imm);
    if (!r.ok) failed++;
    console.log(`${r.ok ? "MATCH   " : "MISMATCH"}  ${c.name}\n          ${c.chain === "robinhood" ? "Robinhood Chain" : "ANT CHAIN"} ${c.address}\n          source ${c.src}${r.ok ? ` · ${r.exact ? "exact match" : "code match (build metadata differs)"} · ${r.bytes} bytes, ${r.immBytes} constructor-set bytes skipped` : ` · ${r.why}`}`);
  } catch (e) {
    failed++;
    console.log(`ERROR     ${c.name} ${c.address}: ${e.message}`);
  }
}
console.log(failed ? `\n${failed} contract(s) did not match.` : `\nAll ${CHECKS.length} contracts match the source in this repository.`);
process.exit(failed ? 1 : 0);
