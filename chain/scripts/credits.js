// ANT CHAIN gas credits: turns $ANTC staking credits into gas on ANT CHAIN.
//
//   GET  /info                   claim size, cost in credits, today's budget, redeemer
//   POST /claim {address, message, signature}
//
// A claim is signed by the wallet (a free message, no transaction) so nobody can spend someone
// else's credits. The service then:
//   1. checks creditsOf(user) on the staking contract (Robinhood Chain),
//   2. records the use on chain: spendCredits(user, cost, ref)  -- anyone can audit every claim,
//   3. sends the gas (native ANT, or tANT on testnet) to the user on ANT CHAIN.
// If step 3 fails after step 2, the claim is retried every minute until it is delivered.
// Limits: one claim per address per 24 h and a daily budget of gas for everyone together.
//
// Env: NETWORK, REDEEMER_PRIVATE_KEY / REDEEMER_ADDRESS (must be the staking contract's redeemer),
//      PARENT_RPC, L3_RPC, GAS_PER_CLAIM (ANT, default 0.0005 mainnet / 0.01 testnet),
//      CREDITS_PER_CLAIM (token-days; required, e.g. 1000), DAILY_BUDGET (ANT, default 50 claims' worth), PORT
import http from "node:http";
import { createPublicClient, createWalletClient, defineChain, http as viemHttp, parseAbi, parseEther, formatEther, isAddress, getAddress, keccak256, toHex, recoverMessageAddress } from "viem";
import { NETWORK, S, parentPublicClient as l2, walletClient, account, loadDeployment } from "./lib.js";

if (!["mainnet", "testnet"].includes(NETWORK)) throw new Error("Run with NETWORK=mainnet or testnet.");
const dep = loadDeployment();
const STAKING = dep.antcStaking?.address;
if (!STAKING) throw new Error("No staking contract in the deployment file.");
const L3_RPC = process.env.L3_RPC || (NETWORK === "testnet" ? "https://rpc.testnet.antchain.tech" : "https://rpc.antchain.tech");
const l3chain = defineChain({ id: S.chainId, name: S.chainName, nativeCurrency: { name: "ANT", symbol: "ANT", decimals: 18 }, rpcUrls: { default: { http: [L3_RPC] } } });
const l3 = createPublicClient({ chain: l3chain, transport: viemHttp(L3_RPC, { timeout: 60_000 }) });
const me = account("REDEEMER");
const l2w = walletClient("REDEEMER");
const l3w = createWalletClient({ account: me, chain: l3chain, transport: viemHttp(L3_RPC, { timeout: 60_000 }) });

const GAS = parseEther(process.env.GAS_PER_CLAIM || (NETWORK === "testnet" ? "0.01" : "0.0005"));
const COST = process.env.CREDITS_PER_CLAIM ? parseEther(process.env.CREDITS_PER_CLAIM) : null; // credits are token-days, 18 decimals
const BUDGET = process.env.DAILY_BUDGET ? parseEther(process.env.DAILY_BUDGET) : GAS * 50n;
const DAY = 24 * 3600 * 1000, MAX_AGE = 10 * 60 * 1000;
const PORT = Number(process.env.PORT || 8080);
const stakingAbi = parseAbi([
  "function creditsOf(address) view returns (uint256)",
  "function redeemer() view returns (address)",
  "function spendCredits(address user, uint256 amount, bytes32 ref)",
]);

const byAddr = new Map(); // address -> last claim time
let day = new Date().toISOString().slice(0, 10), spentToday = 0n;
const pending = []; // claims recorded on chain but not yet delivered
let queue = Promise.resolve(); // one claim at a time so nonces never collide

const log = (msg, extra = {}) => console.log(JSON.stringify({ t: new Date().toISOString(), msg, ...extra }));
const json = (res, code, body) => { res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" }); res.end(JSON.stringify(body)); };
const rollDay = () => { const d = new Date().toISOString().slice(0, 10); if (d !== day) { day = d; spentToday = 0n; } };

/** The exact text the website asks the wallet to sign. */
export const claimMessage = (address, issued) => `ANT CHAIN gas claim\nAddress: ${address}\nChain: ${S.chainId}\nIssued: ${issued}`;

async function deliver(p) {
  const h = await l3w.sendTransaction({ to: p.address, value: GAS });
  const r = await l3.waitForTransactionReceipt({ hash: h });
  if (r.status !== "success") throw new Error(`gas transfer reverted ${h}`);
  return h;
}

async function claim(address) {
  rollDay();
  if (!COST) throw Object.assign(new Error("Gas claims are not open yet."), { code: 503 });
  if (spentToday + GAS > BUDGET) throw Object.assign(new Error("Today's gas budget is used up. Try again tomorrow."), { code: 429 });
  const last = byAddr.get(address) || 0;
  if (Date.now() - last < DAY) throw Object.assign(new Error("This wallet already claimed gas today."), { code: 429, retryAt: new Date(last + DAY).toISOString() });
  const [credits, redeemer, gasLeft] = await Promise.all([
    l2.readContract({ address: STAKING, abi: stakingAbi, functionName: "creditsOf", args: [address] }),
    l2.readContract({ address: STAKING, abi: stakingAbi, functionName: "redeemer" }),
    l3.getBalance({ address: me.address }),
  ]);
  if (redeemer.toLowerCase() !== me.address.toLowerCase()) throw Object.assign(new Error("Gas claims are not open yet."), { code: 503 });
  if (credits < COST) throw Object.assign(new Error(`You have ${formatEther(credits)} credits; a claim needs ${formatEther(COST)}. Keep staking to earn more.`), { code: 402 });
  if (gasLeft < GAS * 2n) throw Object.assign(new Error("The gas pool is being refilled. Try again later."), { code: 503 });

  const ref = keccak256(toHex(`${address}:${Date.now()}`));
  let sh;
  try {
    sh = await l2w.writeContract({ address: STAKING, abi: stakingAbi, functionName: "spendCredits", args: [address, COST, ref] });
    const sr = await l2.waitForTransactionReceipt({ hash: sh, timeout: 120_000 });
    if (sr.status !== "success") throw new Error(`spendCredits reverted ${sh}`);
  } catch (e) {
    log("spendCredits failed", { address, err: e.shortMessage || e.message, tx: sh || null });
    throw Object.assign(new Error("Recording the claim failed, so no credits were used. Try again in a minute."), { code: 502 });
  }
  // the daily limits count only claims whose credits were really spent
  byAddr.set(address, Date.now());
  spentToday += GAS;
  const p = { address, ref, spendTx: sh };
  try {
    p.gasTx = await deliver(p);
  } catch (e) {
    pending.push(p);
    log("delivery failed, queued for retry", { address, ref, err: e.shortMessage || e.message });
  }
  log("claim", { address, credits: formatEther(COST), gas: formatEther(GAS), spendTx: sh, gasTx: p.gasTx || null });
  return { address, credits: formatEther(COST), gas: formatEther(GAS), spendTx: sh, gasTx: p.gasTx || null, queued: !p.gasTx };
}

setInterval(() => {
  if (!pending.length) return;
  queue = queue.then(async () => {
    for (const p of [...pending]) {
      try { p.gasTx = await deliver(p); pending.splice(pending.indexOf(p), 1); log("delivered after retry", { address: p.address, gasTx: p.gasTx }); }
      catch (e) { log("retry failed", { address: p.address, err: e.shortMessage || e.message }); }
    }
  }).catch(() => {});
}, 60_000);

http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && (req.url.startsWith("/info") || req.url.startsWith("/health"))) {
      rollDay();
      const [redeemer, gasLeft] = await Promise.all([
        l2.readContract({ address: STAKING, abi: stakingAbi, functionName: "redeemer" }).catch(() => null),
        l3.getBalance({ address: me.address }).catch(() => 0n),
      ]);
      const open = !!COST && redeemer?.toLowerCase() === me.address.toLowerCase();
      return json(res, 200, { ok: true, open, network: NETWORK, staking: STAKING, redeemer: me.address, gasPerClaim: formatEther(GAS), creditsPerClaim: COST ? formatEther(COST) : null, budgetLeftToday: formatEther(BUDGET > spentToday ? BUDGET - spentToday : 0n), poolGas: formatEther(gasLeft), pending: pending.length });
    }
    if (req.method !== "POST" || !req.url.startsWith("/claim")) return json(res, 404, { error: "not found" });
    let body = "";
    for await (const chunk of req) { body += chunk; if (body.length > 4000) return json(res, 413, { error: "too large" }); }
    let b;
    try { b = JSON.parse(body); } catch { return json(res, 400, { error: "Send JSON." }); }
    if (!isAddress(b.address || "") || typeof b.message !== "string" || typeof b.signature !== "string") return json(res, 400, { error: "Missing address, message or signature." });
    const address = getAddress(b.address);
    const m = /^ANT CHAIN gas claim\nAddress: (0x[0-9a-fA-F]{40})\nChain: (\d+)\nIssued: (.+)$/.exec(b.message);
    if (!m || getAddress(m[1]) !== address || Number(m[2]) !== S.chainId) return json(res, 400, { error: "The signed message does not match." });
    const issued = Date.parse(m[3]);
    if (!issued || Math.abs(Date.now() - issued) > MAX_AGE) return json(res, 400, { error: "The signature expired. Try again." });
    // works for regular wallets and for smart accounts (ERC-1271 / EIP-7702) on Robinhood Chain
    let valid = await l2.verifyMessage({ address, message: b.message, signature: b.signature }).catch(() => false);
    // an EIP-7702 smart account is still controlled by its own key: accept a plain signature from that key
    if (!valid && /^0x[0-9a-fA-F]{130}$/.test(b.signature)) valid = (await recoverMessageAddress({ message: b.message, signature: b.signature }).catch(() => null)) === address;
    if (!valid) return json(res, 401, { error: "The signature does not belong to this wallet." });
    let out;
    queue = queue.then(async () => { out = await claim(address); }).catch((e) => { out = { error: e.message, code: e.code || 500, retryAt: e.retryAt }; });
    await queue;
    if (out.error) return json(res, out.code, { error: out.error, retryAt: out.retryAt });
    return json(res, 200, out);
  } catch (e) {
    log("error", { err: e.message });
    return json(res, 500, { error: "Something went wrong. Try again in a minute." });
  }
}).listen(PORT, () => log("credits service started", { network: NETWORK, staking: STAKING, redeemer: me.address, gasPerClaim: formatEther(GAS), creditsPerClaim: COST ? formatEther(COST) : null }));
