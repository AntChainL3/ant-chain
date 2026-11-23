// ANT CHAIN home: live chain readout, block ledger, orbit linework, data packets,
// scroll-driven fee route, console "Run it", copy, add network.
import { L3, L2, ADDR, TOKEN, ACTIVE } from "./config.js";
import { onAntPrice } from "./antprice.js";
import "./netui.js";
const warn = (e) => console.warn(e); // background refreshes: log failures instead of leaving promises unhandled

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const EXPLORER = ACTIVE === "mainnet" ? "/explorer" : "/explorer/testnet";
const TRANSFER_GAS = 28402n; // measured on mainnet, 20 Nov 2026

// ---------- live values ----------
$$("[data-live]").forEach((el) => { if (el.textContent.trim() === "…") { el.textContent = " "; el.classList.add("loading"); } });
function setLive(key, text) {
  $$(`[data-live="${key}"]`).forEach((el) => {
    const was = el.classList.contains("loading");
    if (el.textContent === text && !was) return;
    el.textContent = text;
    el.classList.remove("loading");
    if (!was && !reduced) { el.classList.remove("tick"); void el.offsetWidth; el.classList.add("tick"); }
  });
}

async function rpc(url, method, params = []) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(8000) });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j.result;
}
let l2i = 0;
async function l2(method, params) {
  for (let i = 0; i < L2.rpcs.length; i++) {
    const url = L2.rpcs[(l2i + i) % L2.rpcs.length];
    try { const res = await rpc(url, method, params); l2i = (l2i + i) % L2.rpcs.length; return res; } catch { /* next */ }
  }
  throw new Error("parent RPC unavailable");
}
const pad = (a) => a.toLowerCase().replace("0x", "").padStart(64, "0");
const call = (to, data) => l2("eth_call", [{ to, data }, "latest"]);
const fmtInt = (n) => Number(n).toLocaleString("en-US");
const sig = (x, d = 2) => (x === 0 ? "0" : x.toLocaleString("en-US", { maximumSignificantDigits: d }));
const units = (wei, digits = 4) => (Number(wei) / 1e18).toLocaleString("en-US", { maximumFractionDigits: digits });

let lastBlock = null, gasPrice = null, antUsd = null;

async function refreshL3() {
  try {
    const [bh, gh] = await Promise.all([rpc(L3.rpc, "eth_blockNumber"), rpc(L3.rpc, "eth_gasPrice")]);
    const block = BigInt(bh);
    gasPrice = BigInt(gh);
    ["block", "block2", "block3", "block4"].forEach((k) => setLive(k, fmtInt(block)));
    $$("[data-live-href=block]").forEach((a) => { a.href = `${EXPLORER}/block/${block}`; });
    const g = `${sig(Number(gasPrice) / 1e9, 3)} gwei`;
    setLive("gas", g); setLive("gas2", g);
    setLive("updated", new Date().toLocaleTimeString());
    renderFee();
    if (lastBlock !== null && block > lastBlock) onNewBlocks(lastBlock + 1n, block).catch(warn);
    lastBlock = block;
  } catch {
    setLive("block", "offline"); setLive("updated", "RPC did not answer, retrying");
  }
}

let lastTs = null;
async function refreshBlockTime() {
  try {
    const latest = await rpc(L3.rpc, "eth_getBlockByNumber", ["latest", false]);
    lastTs = Number(BigInt(latest.timestamp));
    setLive("lastblock", lastLabel(lastTs));
  } catch { /* keep last */ }
}
// Blocks are made only when there is a transaction, so a quiet chain shows "on demand" instead of an old age.
const lastLabel = (ts) => (Date.now() / 1000 - ts > 3600 ? "on demand" : ago(ts));
setInterval(() => { if (lastTs) document.querySelectorAll('[data-live="lastblock"]').forEach((el) => { el.textContent = lastLabel(lastTs); el.title = `Last block ${ago(lastTs)}. ANT CHAIN makes a block when there is a transaction.`; }); }, 1000);

async function refreshL2() {
  const SEL = { batchCount: "0x06f13056", balanceOf: "0x70a08231", antUsd: "0xca3d55bd", currentRate: "0xf9f8bdb7", isStaked: "0x6177fd18" };
  const VALIDATOR = ADDR.validator;
  await Promise.allSettled([
    call(ADDR.sequencerInbox, SEL.batchCount).then((h) => setLive("batches", fmtInt(BigInt(h)))),
    call(ADDR.ant, SEL.balanceOf + pad(ADDR.bridge)).then((h) => setLive("escrow", `${units(BigInt(h), 2)} ${TOKEN}`)),
    call(ADDR.pricer, SEL.currentRate).then((h) => setLive("rate", `${(Number(BigInt(h)) / 1e18).toFixed(1)} ANT/ETH`)),
    call(ADDR.rollup, SEL.isStaked + pad(VALIDATOR)).then((h) => {
      const ok = BigInt(h) === 1n;
      setLive("validator", ok ? "Staked" : "Not staked");
      setLive("validator2", ok ? "staked, bond posted" : "not staked");
    }),
  ]);
}

function renderFee() {
  if (gasPrice === null) return;
  const feeAnt = Number(gasPrice * TRANSFER_GAS) / 1e18;
  setLive("fee-ant", `${sig(feeAnt, 2)} ${TOKEN}`);
  if (antUsd !== null) {
    const usd = feeAnt * antUsd;
    const t = usd < 0.0001 ? `$${usd.toFixed(6)}` : `$${sig(usd, 2)}`;
    setLive("fee", t); setLive("fee-usd", t);
  } else setLive("fee", `${sig(feeAnt, 2)} ${TOKEN}`);
}

onAntPrice((p) => { antUsd = p; renderFee(); }); // live market price, refreshed every 15 s

// ---------- ledger ----------
const ledger = $("[data-ledger]");
const blocks = new Map();
const LEDGER_N = 14;
function ago(ts) {
  const s = Math.max(0, Math.round(Date.now() / 1000 - ts));
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : `${Math.floor(s / 3600)}h ago`;
}
function blockEl(b, isNew) {
  // built with DOM nodes and textContent: nothing from the RPC is parsed as HTML
  const n = BigInt(b.number), txs = b.transactions.length, used = Number(BigInt(b.gasUsed)), ts = Number(BigInt(b.timestamp));
  const w = Math.min(100, (used / 1_000_000) * 100);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const li = document.createElement("li");
  const a = el("a", `blk${isNew ? " new" : ""}`);
  a.href = `${EXPLORER}/block/${n}`;
  const top = el("span", "blk-top"); const age = el("span", "", ago(ts)); age.dataset.ago = String(ts);
  top.append(el("span", "", "block"), age);
  const bar = el("span", "blk-bar"); bar.title = "gas used"; const fill = el("i"); fill.style.setProperty("--w", `${w.toFixed(1)}%`); bar.append(fill);
  const meta = el("span", "blk-meta"); meta.append(el("span", "", `${txs} tx`), el("span", "", `${fmtInt(used)} gas`));
  a.append(top, el("span", "blk-n", `#${fmtInt(n)}`), bar, meta);
  li.append(a);
  return li;
}
async function loadLedger() {
  if (!ledger) return;
  ledger.innerHTML = Array.from({ length: 8 }, () => '<li><span class="blk skel"></span></li>').join("");
  try {
    const head = BigInt(await rpc(L3.rpc, "eth_blockNumber"));
    const nums = [];
    for (let i = 0n; i < BigInt(LEDGER_N) && head - i >= 0n; i++) nums.push(head - i);
    const list = await Promise.all(nums.map((n) => rpc(L3.rpc, "eth_getBlockByNumber", ["0x" + n.toString(16), false])));
    ledger.innerHTML = "";
    list.filter(Boolean).forEach((b) => { blocks.set(b.number, b); ledger.appendChild(blockEl(b, false)); });
    window.antLedger = list.filter(Boolean).map(blockInfo); // kept for the 3D stack if it loads later
    window.dispatchEvent(new CustomEvent("antchain:ledger", { detail: window.antLedger }));
  } catch {
    ledger.innerHTML = '<li class="muted mono" style="padding:20px 0">The chain did not answer. Retrying shortly.</li>';
  }
}
// bento bars: one bar per recent block, height = gas used (layout previews)
const barsBox = document.querySelector("[data-bars]");
function drawBars(list) {
  if (!barsBox || !list?.length) return;
  const recent = list.slice(0, 24).reverse();
  const max = Math.max(...recent.map((b) => b.gasUsed), 1);
  barsBox.innerHTML = recent.map((b, i) => `<i style="--h:${Math.max(6, (b.gasUsed / max) * 100).toFixed(1)}%;--i:${i};--o:${(0.35 + 0.65 * (i + 1) / recent.length).toFixed(2)}" title="block ${b.number}: ${b.gasUsed.toLocaleString("en-US")} gas"></i>`).join("");
}
addEventListener("antchain:ledger", (e) => drawBars(e.detail));
addEventListener("antchain:newblock", () => drawBars(window.antLedger));

const blockInfo = (b) => ({ number: Number(BigInt(b.number)), gasUsed: Number(BigInt(b.gasUsed)), txs: b.transactions.length });
async function onNewBlocks(from, to) {
  pulsePackets();
  $$("[data-live-dot]").forEach((d) => { d.classList.remove("flash"); void d.offsetWidth; d.classList.add("flash"); });
  if (!ledger) return;
  const start = to - from > 5n ? to - 5n : from;
  for (let n = start; n <= to; n++) {
    try {
      const b = await rpc(L3.rpc, "eth_getBlockByNumber", ["0x" + n.toString(16), false]);
      if (!b || blocks.has(b.number)) continue;
      blocks.set(b.number, b);
      ledger.prepend(blockEl(b, true));
      window.antLedger = [blockInfo(b), ...(window.antLedger || [])].slice(0, 60);
      window.dispatchEvent(new CustomEvent("antchain:newblock", { detail: blockInfo(b) }));
      while (ledger.children.length > LEDGER_N) ledger.lastElementChild.remove();
    } catch { /* skip */ }
  }
}
setInterval(() => $$("[data-ago]").forEach((el) => { el.textContent = ago(Number(el.dataset.ago)); }), 1000);

// ---------- UTC clock ----------
const clock = $("[data-clock]");
if (clock) {
  const tickClock = () => { clock.textContent = `${new Date().toISOString().slice(11, 19)} UTC`; };
  tickClock(); setInterval(tickClock, 1000);
}

const NS = "http://www.w3.org/2000/svg";
function el(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; }

// ---------- data packets: halftone clusters of cobalt squares that drift and burst on each block ----------
const pc = $("[data-packets]");
let pulsePackets = () => {};
if (pc) {
  const ctx = pc.getContext("2d");
  let W = 0, H = 0, dpr = 1, cells = [];
  const resize = () => {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = pc.clientWidth; H = pc.clientHeight;
    pc.width = W * dpr; pc.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
  };
  function seed() {
    cells = [];
    const S = W < 700 ? 7 : 9;
    const clusters = W < 700 ? 4 : 7;
    for (let c = 0; c < clusters; c++) {
      const cx = W * (0.45 + Math.random() * 0.55), cy = H * (0.08 + Math.random() * 0.8);
      const n = 30 + Math.random() * 70, spread = 40 + Math.random() * 90;
      for (let i = 0; i < n; i++) {
        const gx = Math.round((cx + (Math.random() - .5) * spread * 2) / S) * S;
        const gy = Math.round((cy + (Math.random() - .5) * spread) / S) * S;
        cells.push({ x: gx, y: gy, s: S - 2, a: .08 + Math.random() * .5, ph: Math.random() * 6.28, sp: .4 + Math.random() * 1.2, burst: 0 });
      }
    }
  }
  let boost = 0;
  pulsePackets = () => { boost = 1; cells.forEach((c) => { if (Math.random() < .35) c.burst = 1; }); };
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(pc);
  const draw = (t) => {
    if (visible) {
      ctx.clearRect(0, 0, W, H);
      for (const c of cells) {
        const flick = reduced ? 1 : .55 + .45 * Math.sin(t / 1000 * c.sp + c.ph);
        const a = Math.min(.85, c.a * flick + c.burst * .6);
        ctx.fillStyle = c.burst > .02 ? `rgba(255,255,255,${a})` : `rgba(255,178,26,${a * 0.8})`;
        ctx.fillRect(c.x, c.y, c.s, c.s);
        c.burst *= .94;
      }
      boost *= .95;
    }
    if (!reduced) requestAnimationFrame(draw);
  };
  addEventListener("resize", resize);
  resize();
  requestAnimationFrame(draw);
}

// ---------- route: scroll is the clock ----------
const route = $("[data-route]");
if (route) {
  const nodesG = $("[data-nodes]", route), packet = $("[data-packet]", route), fill = $("[data-track-fill]", route);
  const stops = $$("[data-stop]", route), frame = $("[data-frame]", route);
  const NAMES = ["WALLET", "SEQUENCER", "BATCH", "VALIDATOR", "ETHEREUM"];
  const X = [40, 270, 500, 730, 960];
  const nodes = NAMES.map((name, i) => {
    const g = el("g", { class: "node" }, nodesG);
    el("circle", { cx: X[i], cy: 60, r: 16 }, g);
    const t = el("text", { x: X[i], y: 106 }, g); t.textContent = name;
    return g;
  });
  stops[0]?.classList.add("on"); nodes[0].classList.add("on");
  let current = 0;
  const update = () => {
    if (matchMedia("(max-width: 860px)").matches) return;
    const r = route.getBoundingClientRect();
    const total = r.height - innerHeight;
    const p = Math.min(1, Math.max(0, -r.top / total));
    fill.style.setProperty("--p", p.toFixed(4));
    packet.setAttribute("cx", (40 + 920 * p).toFixed(1));
    if (frame) frame.textContent = String(Math.max(1, Math.round(p * 240))).padStart(3, "0");
    const idx = Math.min(4, Math.floor(p * 5 * 0.999));
    nodes.forEach((n, i) => n.classList.toggle("on", i <= idx));
    if (idx !== current) { stops[current]?.classList.remove("on"); stops[idx]?.classList.add("on"); current = idx; }
  };
  addEventListener("scroll", update, { passive: true });
  addEventListener("resize", update);
  update();
}

// ---------- console tabs + Run it ----------
const tabs = $$('.console [role="tab"]');
tabs.forEach((t, i) => {
  const select = () => {
    tabs.forEach((o) => { const on = o === t; o.setAttribute("aria-selected", on); o.tabIndex = on ? 0 : -1; document.getElementById(o.getAttribute("aria-controls")).hidden = !on; });
  };
  t.addEventListener("click", select);
  t.addEventListener("keydown", (e) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    const n = tabs[(i + d + tabs.length) % tabs.length]; n.focus(); n.click();
  });
});
const runBtn = $("[data-run]"), runOut = $("[data-run-out] code");
runBtn?.addEventListener("click", async () => {
  runBtn.disabled = true;
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  const t0 = performance.now();
  try {
    const r = await fetch(L3.rpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }) });
    const text = await r.text();
    const ms = Math.round(performance.now() - t0);
    const n = BigInt(JSON.parse(text).result);
    runOut.innerHTML += `\n\n<span class="s">${esc(text.trim())}</span>\n<span class="ok">✓</span> block ${fmtInt(n)} · answered in ${ms} ms`;
  } catch {
    runOut.innerHTML += `\n\n<span class="k">✗</span> no answer from the RPC, try again`;
  }
  runBtn.disabled = false;
  runBtn.innerHTML = 'Run again <span class="ar" aria-hidden="true">→</span>';
});

// ---------- add network ----------
const walletMsg = $("[data-wallet-msg]");
async function addNetwork() {
  const say = (t, err) => { if (walletMsg) { walletMsg.textContent = t; walletMsg.classList.toggle("error", !!err); } };
  const eth = window.antWallet?.provider || window.ethereum;
  if (!eth) { say("No browser wallet found. Install one such as MetaMask, or add the network by hand from the network details.", true); return; }
  try {
    await eth.request({ method: "wallet_addEthereumChain", params: [{ chainId: L3.hex, chainName: L3.name, nativeCurrency: { name: TOKEN, symbol: TOKEN, decimals: 18 }, rpcUrls: [L3.rpc], blockExplorerUrls: [`${location.origin}${EXPLORER}`] }] });
    say(`${L3.name} added to your wallet.`);
  } catch (e) {
    say(e && e.code === 4001 ? "Request cancelled in your wallet." : "Your wallet could not add the network. Add it by hand from the network details.", true);
  }
}
$$("[data-add-network]").forEach((b) => b.addEventListener("click", addNetwork));

// ---------- copy ----------
$$(".copy.addr").forEach((b) => { const f = b.dataset.copy; b.textContent = `${f.slice(0, 8)}…${f.slice(-6)}`; b.title = f; b.setAttribute("aria-label", `Copy address ${f}`); });
// copying itself is handled for every page by site.js ([data-copy] buttons)

// ---------- hero lines rise on load ----------
requestAnimationFrame(() => $$(".hero .line-mask").forEach((m) => m.classList.add("in")));

// ---------- start ----------
refreshL3().catch(warn); refreshL2().catch(warn); refreshBlockTime().catch(warn); loadLedger().catch(warn);
setInterval(refreshL3, 3000);
setInterval(refreshL2, 30000);
setInterval(refreshBlockTime, 5000);
