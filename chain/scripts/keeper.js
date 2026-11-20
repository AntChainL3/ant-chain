// ANT CHAIN price keeper.
//
// Keeps AntFeeTokenPricer.antUsd (USD per raw ANT, 18 decimals) in line with the market so the
// batch poster is reimbursed fairly in ANT for the ETH it spends.
//
// Price source: Uniswap v4 USDG/ANT pool on Robinhood Chain (spot, sampled every minute,
// median over a window) x Chainlink USDG/USD. Cross-checked against an off-chain quote.
// There is no Chainlink ANT feed on Robinhood Chain yet; when one appears, prefer it.
//
// Safety:
//  - median of samples (resists one-block manipulation), minimum pool liquidity
//  - cross-check vs off-chain quote; skip if they disagree by more than MAX_XCHECK_DIFF
//  - freeze while ANT is paused, its oracle is paused, or within 1h of a corporate action (effectiveAt)
//  - each update stays inside the pricer's on-chain deviation band
//
// Run: node scripts/keeper.js --mainnet            (sends transactions)
//      DRY_RUN=1 node scripts/keeper.js --mainnet  (logs decisions only)
import http from "node:http";
import { parseAbi, keccak256, encodeAbiParameters, formatEther, parseEther } from "viem";
import { NETWORK, parentPublicClient as client, walletClient, account, loadDeployment, ANT_TOKEN } from "./lib.js";

if (NETWORK !== "mainnet") throw new Error("Keeper runs on mainnet only (use --mainnet).");

// ---------- configuration ----------
const CFG = {
  pricer: process.env.PRICER_ADDRESS || loadDeployment().feeTokenPricer || "0x87b35eb0ed8724250126fd16ba3c1f3509eeb2ab",
  poolManager: "0x8366a39cc670b4001a1121b8f6a443a643e40951", // Uniswap v4 PoolManager on Robinhood Chain
  poolId: process.env.ANT_POOL_ID || "0x2f7a8107d478db53f870fbd973b95cf7ad6baeb7ed5d9bf3a04927e1700d7988", // USDG/ANT 0.25%
  usdg: "0x5fc5360d0400a0fd4f2af552add042d716f1d168",
  usdgUsdFeed: "0x61B7e5650328764B076A108EFF5fa7282a1B9aD2", // Chainlink USDG / USD
  antRegistry: "0xe10b6f6b275de231345c20d14ab812db62151b00", // Robinhood stock token registry/beacon
  sampleEveryMs: Number(process.env.SAMPLE_EVERY_MS || 60_000),
  windowSamples: Number(process.env.WINDOW_SAMPLES || 30), // 30 x 1 min
  minSamples: Number(process.env.MIN_SAMPLES || 10),
  minLiquidity: BigInt(process.env.MIN_POOL_LIQUIDITY || "100000000000000000"), // 1e17 virtual L
  updateThreshold: Number(process.env.UPDATE_THRESHOLD || 0.005), // 0.5%
  maxAgeBeforeRefreshSec: Number(process.env.MAX_AGE_SEC || 6 * 3600),
  maxXcheckDiff: Number(process.env.MAX_XCHECK_DIFF || 0.05), // 5%
  corporateActionFreezeSec: 3600,
  dryRun: process.env.DRY_RUN === "1",
  port: Number(process.env.PORT || 8080),
};

const pricerAbi = parseAbi([
  "function antUsd() view returns (uint256)",
  "function antUsdUpdatedAt() view returns (uint256)",
  "function ethUsd() view returns (uint256)",
  "function maxDeviationBps() view returns (uint256)",
  "function minUpdateInterval() view returns (uint256)",
  "function keeper() view returns (address)",
  "function currentRate() view returns (uint256)",
  "function submitAntPrice(uint256)",
]);
const extAbi = parseAbi(["function extsload(bytes32) view returns (bytes32)"]);
const feedAbi = parseAbi(["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"]);
const tokenAbi = parseAbi([
  "function paused() view returns (bool)",
  "function tokenPaused() view returns (bool)",
  "function oraclePaused() view returns (bool)",
  "function effectiveAt() view returns (uint256)",
  "function uiMultiplier() view returns (uint256)",
  "function newUIMultiplier() view returns (uint256)",
]);
const registryAbi = parseAbi(["function paused() view returns (bool)"]);

const keeper = account("KEEPER");
const wallet = walletClient("KEEPER");
const samples = [];
const status = { ok: false, startedAt: new Date().toISOString(), network: NETWORK, keeper: keeper.address, dryRun: CFG.dryRun };

function log(msg, extra = {}) {
  console.log(JSON.stringify({ t: new Date().toISOString(), msg, ...extra }));
}
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// ---------- price reads ----------
async function poolPriceUsd() {
  const base = BigInt(keccak256(encodeAbiParameters([{ type: "bytes32" }, { type: "uint256" }], [CFG.poolId, 6n])));
  const slot = (n) => "0x" + (base + n).toString(16).padStart(64, "0");
  const [slot0, liq] = await Promise.all([
    client.readContract({ address: CFG.poolManager, abi: extAbi, functionName: "extsload", args: [slot(0n)] }),
    client.readContract({ address: CFG.poolManager, abi: extAbi, functionName: "extsload", args: [slot(3n)] }),
  ]);
  const sqrtP = BigInt(slot0) & ((1n << 160n) - 1n);
  const liquidity = BigInt(liq) & ((1n << 128n) - 1n);
  if (sqrtP === 0n) throw new Error("pool not initialised");
  if (liquidity < CFG.minLiquidity) throw new Error(`pool liquidity too low: ${liquidity}`);
  // currency0 = USDG (6 dp), currency1 = ANT (18 dp): price = ANT_raw per USDG_raw
  const antRawPerUsdgRaw = Number(sqrtP) ** 2 / 2 ** 192;
  const antPerUsdg = antRawPerUsdgRaw * 10 ** (6 - 18);
  const usdgPerAnt = 1 / antPerUsdg;

  const [, answer, , updatedAt] = await client.readContract({ address: CFG.usdgUsdFeed, abi: feedAbi, functionName: "latestRoundData" });
  const usdgUsd = Number(answer) / 1e8;
  const age = Date.now() / 1000 - Number(updatedAt);
  if (!(usdgUsd > 0.98 && usdgUsd < 1.02)) throw new Error(`USDG/USD out of range: ${usdgUsd}`);
  if (age > 26 * 3600) throw new Error(`USDG/USD feed stale: ${Math.round(age / 3600)}h`);
  return usdgPerAnt * usdgUsd;
}

async function offchainPriceUsd() {
  try {
    const r = await fetch("https://api.coinpaprika.com/v1/tickers/ant-anthropic-pbc-robinhood-token", { signal: AbortSignal.timeout(10_000) });
    if (!r.ok) return null;
    const p = (await r.json())?.quotes?.USD?.price;
    return typeof p === "number" && p > 0 ? p : null;
  } catch {
    return null;
  }
}

async function freezeReason() {
  const [paused, tokenPaused, oraclePaused, effectiveAt, ui, newUi, regPaused] = await Promise.all([
    client.readContract({ address: ANT_TOKEN, abi: tokenAbi, functionName: "paused" }),
    client.readContract({ address: ANT_TOKEN, abi: tokenAbi, functionName: "tokenPaused" }),
    client.readContract({ address: ANT_TOKEN, abi: tokenAbi, functionName: "oraclePaused" }),
    client.readContract({ address: ANT_TOKEN, abi: tokenAbi, functionName: "effectiveAt" }),
    client.readContract({ address: ANT_TOKEN, abi: tokenAbi, functionName: "uiMultiplier" }),
    client.readContract({ address: ANT_TOKEN, abi: tokenAbi, functionName: "newUIMultiplier" }),
    client.readContract({ address: CFG.antRegistry, abi: registryAbi, functionName: "paused" }),
  ]);
  if (paused || tokenPaused || regPaused) return "ANT transfers paused by issuer";
  if (oraclePaused) return "ANT oracle paused by issuer";
  const now = Date.now() / 1000;
  const eff = Number(effectiveAt);
  if (eff > 0 && Math.abs(now - eff) < CFG.corporateActionFreezeSec) return `corporate action window (effectiveAt ${eff})`;
  if (ui !== newUi && eff > now) return `pending multiplier change at ${eff}`;
  return null;
}

// ---------- main loop ----------
async function tick() {
  try {
    const p = await poolPriceUsd();
    samples.push(p);
    while (samples.length > CFG.windowSamples) samples.shift();
    status.lastPoolPrice = p;
    status.samples = samples.length;

    if (samples.length < CFG.minSamples) {
      log("collecting samples", { have: samples.length, need: CFG.minSamples, price: p });
      status.ok = true;
      return;
    }

    const target = median(samples);
    status.medianPrice = target;

    const frozen = await freezeReason();
    if (frozen) {
      status.frozen = frozen;
      log("frozen, no update", { reason: frozen });
      return;
    }
    status.frozen = null;

    const off = await offchainPriceUsd();
    status.offchainPrice = off;
    if (off !== null && Math.abs(target / off - 1) > CFG.maxXcheckDiff) {
      status.ok = false;
      log("cross-check failed, no update", { median: target, offchain: off });
      return;
    }

    const [cur, updatedAt, maxDevBps, minInterval, onchainKeeper] = await Promise.all([
      client.readContract({ address: CFG.pricer, abi: pricerAbi, functionName: "antUsd" }),
      client.readContract({ address: CFG.pricer, abi: pricerAbi, functionName: "antUsdUpdatedAt" }),
      client.readContract({ address: CFG.pricer, abi: pricerAbi, functionName: "maxDeviationBps" }),
      client.readContract({ address: CFG.pricer, abi: pricerAbi, functionName: "minUpdateInterval" }),
      client.readContract({ address: CFG.pricer, abi: pricerAbi, functionName: "keeper" }),
    ]);
    if (onchainKeeper.toLowerCase() !== keeper.address.toLowerCase()) throw new Error(`pricer keeper is ${onchainKeeper}, not ${keeper.address}`);

    const curUsd = Number(formatEther(cur));
    status.onchainPrice = curUsd;
    const age = Date.now() / 1000 - Number(updatedAt);
    const drift = Math.abs(target / curUsd - 1);
    if (drift < CFG.updateThreshold && age < CFG.maxAgeBeforeRefreshSec) {
      status.ok = true;
      log("no update needed", { onchain: curUsd, median: target, drift: +(drift * 100).toFixed(3) });
      return;
    }
    if (age < Number(minInterval)) return;

    // Stay inside the on-chain band with a safety margin of 0.5%.
    const band = Math.max(0, Number(maxDevBps) / 10_000 - 0.005);
    const next = Math.min(Math.max(target, curUsd * (1 - band)), curUsd * (1 + band));
    const nextWei = parseEther(next.toFixed(8));

    if (CFG.dryRun) {
      log("DRY RUN would submit", { from: curUsd, to: next, target });
      status.ok = true;
      return;
    }
    const hash = await wallet.writeContract({ address: CFG.pricer, abi: pricerAbi, functionName: "submitAntPrice", args: [nextWei] });
    const r = await client.waitForTransactionReceipt({ hash });
    const rate = await client.readContract({ address: CFG.pricer, abi: pricerAbi, functionName: "currentRate" });
    status.ok = r.status === "success";
    status.lastUpdate = { at: new Date().toISOString(), from: curUsd, to: next, tx: hash, antPerEth: Number(formatEther(rate)) };
    log("submitted", status.lastUpdate);
  } catch (e) {
    status.ok = false;
    status.lastError = { at: new Date().toISOString(), message: e.shortMessage || e.message };
    log("error", status.lastError);
  } finally {
    status.lastTick = new Date().toISOString();
    try {
      status.keeperEth = Number(formatEther(await client.getBalance({ address: keeper.address })));
      if (status.keeperEth < 0.0005) log("WARNING keeper ETH low", { eth: status.keeperEth });
    } catch {}
  }
}

http
  .createServer((req, res) => {
    const healthy = status.ok && status.lastTick && Date.now() - Date.parse(status.lastTick) < 5 * CFG.sampleEveryMs;
    res.writeHead(req.url === "/health" && !healthy ? 503 : 200, { "content-type": "application/json" });
    res.end(JSON.stringify({ healthy, ...status }, null, 2));
  })
  .listen(CFG.port, () => log("keeper started", { pricer: CFG.pricer, pool: CFG.poolId, keeper: keeper.address, dryRun: CFG.dryRun, port: CFG.port }));

await tick();
setInterval(tick, CFG.sampleEveryMs);
