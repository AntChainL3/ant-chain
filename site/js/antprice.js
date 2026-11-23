// Live ANT price for the whole site, read straight from the market every 15 seconds:
// the Uniswap v4 USDG/ANT pool on Robinhood Chain (the same pool the price keeper samples),
// converted to USD with the Chainlink USDG/USD feed. Falls back to the mainnet fee pricer.
// Read-only; works while ANT CHAIN mainnet is still closed.
import { PRICE_SOURCE } from "./config.js";

const POOL_MANAGER = "0x8366a39cc670b4001a1121b8f6a443a643e40951"; // Uniswap v4 PoolManager on Robinhood Chain
// storage keys of pool 0x2f7a…7988 (USDG/ANT 0.25%) inside PoolManager: slot0 and liquidity
const SLOT0 = "0x71daacf3a595f7e972c8d51137f1541b2182c57d216e0c7b61a32c0f126e901e";
const LIQUIDITY = "0x71daacf3a595f7e972c8d51137f1541b2182c57d216e0c7b61a32c0f126e9021";
const USDG_USD_FEED = "0x61B7e5650328764B076A108EFF5fa7282a1B9aD2"; // Chainlink USDG / USD
const MIN_LIQUIDITY = 100000000000000000n; // same floor as the keeper
const SEL = { extsload: "0x1e2eaeaf", latestRoundData: "0xfeaf968c", antUsd: "0xca3d55bd" };
const EVERY_MS = 15_000;

async function batch(calls) {
  const body = JSON.stringify(calls.map(([to, data], id) => ({ jsonrpc: "2.0", id, method: "eth_call", params: [{ to, data }, "latest"] })));
  for (const url of PRICE_SOURCE.rpcs) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body, signal: AbortSignal.timeout(10_000) });
      const out = await r.json();
      if (!Array.isArray(out)) continue;
      const byId = new Map(out.map((x) => [x.id, x]));
      if (calls.every((_, i) => byId.get(i)?.result)) return calls.map((_, i) => byId.get(i).result);
    } catch { /* next RPC */ }
  }
  throw new Error("price RPC unavailable");
}

async function fromPool() {
  const [slot0, liq, round] = await batch([
    [POOL_MANAGER, SEL.extsload + SLOT0.slice(2)],
    [POOL_MANAGER, SEL.extsload + LIQUIDITY.slice(2)],
    [USDG_USD_FEED, SEL.latestRoundData],
  ]);
  const sqrtP = BigInt(slot0) & ((1n << 160n) - 1n);
  const liquidity = BigInt(liq) & ((1n << 128n) - 1n);
  if (sqrtP === 0n || liquidity < MIN_LIQUIDITY) throw new Error("pool not usable");
  // currency0 = USDG (6 decimals), currency1 = ANT (18 decimals)
  const antPerUsdg = (Number(sqrtP) ** 2 / 2 ** 192) * 1e-12;
  const usdgUsd = Number(BigInt("0x" + round.slice(2 + 64, 2 + 128))) / 1e8; // answer, the 2nd word
  const usd = (usdgUsd > 0.98 && usdgUsd < 1.02 ? usdgUsd : 1) / antPerUsdg;
  if (!(usd > 0 && Number.isFinite(usd))) throw new Error("bad pool price");
  return usd;
}

async function fromPricer() {
  const [h] = await batch([[PRICE_SOURCE.pricer, SEL.antUsd]]);
  return Number(BigInt(h)) / 1e18;
}

export let antUsd = null;
const listeners = new Set();
/** Calls fn(price) now (if known) and on every update. */
export function onAntPrice(fn) { listeners.add(fn); if (antUsd !== null) fn(antUsd); }

async function tick() {
  let p = null;
  try { p = await fromPool(); } catch { try { p = await fromPricer(); } catch { /* keep the last price */ } }
  if (p === null) return;
  antUsd = p;
  const t = `$${p.toFixed(2)}`;
  document.querySelectorAll("[data-app-price], [data-live='antusd']").forEach((el) => { el.textContent = t; });
  listeners.forEach((fn) => fn(p));
}
tick().catch((e) => console.warn(e));
setInterval(() => { if (!document.hidden) tick().catch((e) => console.warn(e)); }, EVERY_MS);
document.addEventListener("visibilitychange", () => { if (!document.hidden) tick().catch((e) => console.warn(e)); });
