// ANT CHAIN launchpad: create tokens that trade on a bonding curve priced in $ANTC (tANTC on testnet),
// buy and sell on the curve, and follow each token until it graduates to the exchange.
// Everything shown here is read from the AntcLaunchpad contract; text from token creators is always
// rendered as text (textContent), never as HTML.
import { LAUNCHPAD, L3, ACTIVE } from "./config.js";
import { viem, l3, state, onWallet, connect, write, friendlyError, fmt, short } from "./wallet.js";

const warn = (e) => console.warn(e);
const { parseAbi, parseAbiItem, parseUnits, decodeEventLog, maxUint256, getAddress, isAddress } = viem;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const SYM = LAUNCHPAD.quoteSymbol === "ANTC" ? "$ANTC" : LAUNCHPAD.quoteSymbol;
const EXPLORER = ACTIVE === "mainnet" ? "/explorer" : "/explorer/testnet";
const CURVE = 800_000_000n * 10n ** 18n, SUPPLY = 1_000_000_000n * 10n ** 18n;
const SLIPPAGE_BPS = 100n; // 1%

$$("[data-lp-sym]").forEach((el) => { el.textContent = SYM; });

const padAbi = parseAbi([
  "function create(string name, string symbol, string metadata, uint256 buyQuote, uint256 minTokensOut, uint256 deadline) returns (address token, uint256 tokensOut)",
  "function buy(address token, uint256 quoteIn, uint256 minTokensOut, uint256 deadline) returns (uint256)",
  "function sell(address token, uint256 tokensIn, uint256 minQuoteOut, uint256 deadline) returns (uint256)",
  "function quoteBuy(address token, uint256 quoteIn) view returns (uint256 tokensOut, uint256 quoteUsed)",
  "function quoteSell(address token, uint256 tokensIn) view returns (uint256)",
  "function launches(address) view returns (address creator, uint96 createdAt, uint256 vQuote, uint256 vToken, uint256 realQuote, uint256 sold, uint256 target, address pair, bool graduated)",
  "function tokensPage(uint256 offset, uint256 limit) view returns (address[])",
  "function feeBps() view returns (uint16)",
  "function createFee() view returns (uint256)",
]);
const Launched = parseAbiItem("event Launched(address indexed token, address indexed creator, string name, string symbol, string metadata, address pair, uint256 target)");
const erc20 = parseAbi([
  "function balanceOf(address) view returns (uint256)", "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)", "function drip()",
]);
const PAD = LAUNCHPAD.address;
const read = (functionName, args = [], address = PAD, abi = padAbi) => l3.readContract({ address, abi, functionName, args });
const deadline = () => BigInt(Math.floor(Date.now() / 1000) + 600);
const status = (el, text, kind = "") => { el.textContent = text; el.dataset.kind = kind; };
const amountOf = (v) => { try { const a = parseUnits(String(v || "").trim().replace(",", "."), 18); return a > 0n ? a : 0n; } catch { return 0n; } };
const price = (l) => (l.vToken ? Number(l.vQuote) / Number(l.vToken) : 0);
const fmtPrice = (p) => (p === 0 ? "0" : p < 0.0001 ? p.toExponential(3) : p.toLocaleString("en-US", { maximumSignificantDigits: 4 }));
const pct = (l) => (l.graduated ? 100 : Number((l.sold * 10000n) / CURVE) / 100);


// ---------------------------------------------------------------- data
const tokens = new Map(); // address -> { address, name, symbol, meta, creator, ...launch }
let sort = "new", selected = null, side = "buy", feeBps = 100n;

function parseMeta(s) {
  try { const m = JSON.parse(s); return m && typeof m === "object" ? m : {}; } catch { return { description: String(s || "") }; }
}
const safeUrl = (u) => { try { const x = new URL(String(u)); return x.protocol === "https:" ? x.href : null; } catch { return null; } };

async function loadAll() {
  const [logs, page] = await Promise.all([
    l3.getLogs({ address: PAD, event: Launched, fromBlock: BigInt(LAUNCHPAD.fromBlock || 0), toBlock: "latest" }),
    read("tokensPage", [0n, 200n]),
  ]);
  for (const lg of logs) {
    const a = getAddress(lg.args.token);
    if (!tokens.has(a)) tokens.set(a, { address: a, name: lg.args.name, symbol: lg.args.symbol, meta: parseMeta(lg.args.metadata), creator: lg.args.creator, order: Number(lg.blockNumber) * 1e4 + lg.logIndex });
  }
  await Promise.all(page.map((a) => refreshToken(getAddress(a))));
  renderList();
}

async function refreshToken(a) {
  const r = await read("launches", [a]);
  const t = tokens.get(a) || { address: a, name: "…", symbol: "…", meta: {}, order: 0 };
  Object.assign(t, { creator: r[0], createdAt: Number(r[1]), vQuote: r[2], vToken: r[3], realQuote: r[4], sold: r[5], target: r[6], pair: r[7], graduated: r[8] });
  tokens.set(a, t);
  return t;
}

// ---------------------------------------------------------------- list
function renderList() {
  const ul = $("[data-lp-list]");
  let list = [...tokens.values()];
  if (sort === "new") list.sort((x, y) => y.order - x.order);
  if (sort === "progress") list = list.filter((t) => !t.graduated).sort((x, y) => pct(y) - pct(x));
  if (sort === "grad") list = list.filter((t) => t.graduated).sort((x, y) => y.order - x.order);
  ul.replaceChildren();
  if (!list.length) {
    const li = document.createElement("li"); li.className = "empty";
    li.textContent = sort === "grad" ? "No token has graduated yet." : "No tokens yet. Create the first one.";
    ul.append(li); return;
  }
  for (const t of list) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button"; b.className = "lp-row" + (t.address === selected ? " on" : "");
    const img = document.createElement("span"); img.className = "lp-thumb";
    const src = safeUrl(t.meta.image);
    if (src) { const i = document.createElement("img"); i.src = src; i.alt = ""; i.loading = "lazy"; i.referrerPolicy = "no-referrer"; i.onerror = () => i.remove(); img.append(i); }
    img.append(document.createTextNode(t.symbol.slice(0, 2).toUpperCase()));
    const mid = document.createElement("span"); mid.className = "lp-mid";
    const nm = document.createElement("b"); nm.textContent = t.name;
    const sy = document.createElement("small"); sy.textContent = `$${t.symbol} · ${t.graduated ? "graduated" : `${pct(t).toFixed(1)}%`}`;
    const bar = document.createElement("span"); bar.className = "lp-bar mini"; const fill = document.createElement("i"); fill.style.width = `${pct(t)}%`; bar.append(fill);
    mid.append(nm, sy, bar);
    const right = document.createElement("span"); right.className = "lp-right";
    right.textContent = `${fmtPrice(price(t))} ${SYM}`;
    b.append(img, mid, right);
    b.addEventListener("click", () => select(t.address));
    li.append(b); ul.append(li);
  }
}
$$("[data-sort]").forEach((b) => b.addEventListener("click", () => {
  sort = b.dataset.sort;
  $$("[data-sort]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  renderList();
}));

// ---------------------------------------------------------------- detail
const D = (k) => $(`[data-d="${k}"]`);
async function select(a, push = true) {
  selected = a;
  if (push) { const u = new URL(location.href); u.searchParams.set("t", a); history.replaceState(null, "", u.pathname + u.search); }
  $("[data-lp-detail]").hidden = false;
  renderList();
  await refreshToken(a).catch(warn);
  renderDetail();
  $("[data-lp-detail]").scrollIntoView({ behavior: "smooth", block: "nearest" });
  refreshTrade().catch(warn);
}

function renderDetail() {
  const t = tokens.get(selected); if (!t) return;
  D("name").textContent = t.name;
  D("symbol").textContent = `$${t.symbol}`;
  D("explorer").href = `${EXPLORER}/address/${t.address}`;
  D("desc").textContent = String(t.meta.description || "");
  const img = D("img"); const src = safeUrl(t.meta.image);
  if (src) { img.src = src; img.referrerPolicy = "no-referrer"; img.hidden = false; img.onerror = () => { img.hidden = true; }; } else img.hidden = true;
  const links = D("links"); links.replaceChildren();
  const link = safeUrl(t.meta.link);
  if (link) { const a = document.createElement("a"); a.className = "link"; a.href = link; a.target = "_blank"; a.rel = "noopener nofollow ugc"; a.textContent = `${new URL(link).hostname} ↗`; links.append(a); }
  const p = pct(t);
  D("bar").firstElementChild.style.width = `${p}%`; D("bar").setAttribute("aria-valuenow", String(Math.round(p)));
  D("progress").textContent = t.graduated ? "Graduated" : `${p.toFixed(2)}% of 800M sold`;
  D("price").textContent = `${fmtPrice(price(t))} ${SYM}`;
  D("mcap").textContent = `${Math.round(price(t) * 1e9).toLocaleString("en-US")} ${SYM}`;
  D("raised").textContent = t.graduated ? `${fmt(t.target, 0)} ${SYM} (moved to the pool)` : `${fmt(t.realQuote, 2)} / ${fmt(t.target, 0)} ${SYM}`;
  D("creator").replaceChildren(Object.assign(document.createElement("a"), { className: "link", href: `${EXPLORER}/address/${t.creator}`, textContent: short(t.creator) }));
  D("graduated").hidden = !t.graduated;
  D("swap").href = `/swap/?net=${ACTIVE}`;
  $("[data-trade]").hidden = t.graduated;
}

// ---------------------------------------------------------------- trade
const T = (k) => $(`[data-t="${k}"]`, $("[data-trade]"));
$$("[data-side]").forEach((b) => b.addEventListener("click", () => {
  side = b.dataset.side;
  $$("[data-side]").forEach((x) => { const on = x === b; x.setAttribute("aria-selected", String(on)); x.tabIndex = on ? 0 : -1; });
  $("#lp-amt").value = ""; T("out").textContent = ""; status(T("msg"), "");
  refreshTrade().catch(warn);
}));
let bals = { quote: 0n, token: 0n };
async function refreshTrade() {
  const t = tokens.get(selected); if (!t) return;
  T("label").textContent = side === "buy" ? "You pay" : "You sell";
  T("unit").textContent = side === "buy" ? SYM : `$${t.symbol}`;
  if (state.address) {
    const [q, k] = await Promise.all([read("balanceOf", [state.address], LAUNCHPAD.quote, erc20), read("balanceOf", [state.address], t.address, erc20)]);
    bals = { quote: q, token: k };
    T("bal").textContent = side === "buy" ? `${fmt(q, 4)} ${SYM}` : `${fmt(k, 2)} $${t.symbol}`;
  } else T("bal").textContent = "—";
  paintButtons();
  previewTrade().catch(warn);
}
async function previewTrade() {
  const t = tokens.get(selected); if (!t) return;
  const amt = amountOf($("#lp-amt").value);
  if (!amt) { T("out").textContent = ""; return; }
  if (side === "buy") {
    const [out, used] = await read("quoteBuy", [t.address, amt]);
    T("out").textContent = `≈ ${fmt(out, 2)} $${t.symbol}${used < amt ? ` (uses ${fmt(used, 4)}, sells out the curve)` : ""}`;
  } else {
    const out = await read("quoteSell", [t.address, amt]);
    T("out").textContent = `≈ ${fmt(out, 4)} ${SYM}`;
  }
}
$("#lp-amt").addEventListener("input", () => { $("#lp-amt").value = $("#lp-amt").value.replace(",", ".").replace(/[^0-9.]/g, ""); previewTrade().catch(warn); });
T("max").addEventListener("click", () => { $("#lp-amt").value = viem.formatUnits(side === "buy" ? bals.quote : bals.token, 18); previewTrade().catch(warn); });

function paintButtons() {
  const t = tokens.get(selected);
  const go = $("[data-t=go]"); if (go) go.textContent = !state.address ? "Connect wallet" : side === "buy" ? `Buy${t ? ` $${t.symbol}` : ""}` : `Sell${t ? ` $${t.symbol}` : ""}`;
  const c = $("[data-c=go]"); if (c) c.textContent = state.address ? "Create token" : "Connect wallet";
}

async function approveIfNeeded(token, amount, msg, label) {
  const allowance = await read("allowance", [state.address, PAD], token, erc20);
  if (allowance >= amount) return;
  status(msg, `Approve ${label} for the launchpad in your wallet…`);
  await write(L3.id, { address: token, abi: erc20, functionName: "approve", args: [PAD, maxUint256] }, () => status(msg, "Approval sent. Waiting for ANT CHAIN…"));
}

$("[data-trade]").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = T("msg"), btn = T("go");
  if (!state.address) { connect().catch((err) => status(msg, friendlyError(err), "bad")); return; }
  const t = tokens.get(selected); const amt = amountOf($("#lp-amt").value);
  if (!t || !amt) { status(msg, "Enter an amount.", "bad"); return; }
  btn.disabled = true;
  try {
    if (side === "buy") {
      if (amt > bals.quote) throw new Error(`Not enough ${SYM}.`);
      const [out] = await read("quoteBuy", [t.address, amt]);
      await approveIfNeeded(LAUNCHPAD.quote, amt, msg, SYM);
      status(msg, "Confirm the buy in your wallet…");
      await write(L3.id, { address: PAD, abi: padAbi, functionName: "buy", args: [t.address, amt, (out * (10000n - SLIPPAGE_BPS)) / 10000n, deadline()] }, () => status(msg, "Buy sent. Waiting for ANT CHAIN…"));
    } else {
      if (amt > bals.token) throw new Error(`Not enough $${t.symbol}.`);
      const out = await read("quoteSell", [t.address, amt]);
      await approveIfNeeded(t.address, amt, msg, `$${t.symbol}`);
      status(msg, "Confirm the sell in your wallet…");
      await write(L3.id, { address: PAD, abi: padAbi, functionName: "sell", args: [t.address, amt, (out * (10000n - SLIPPAGE_BPS)) / 10000n, deadline()] }, () => status(msg, "Sell sent. Waiting for ANT CHAIN…"));
    }
    status(msg, "Done.", "ok");
    $("#lp-amt").value = ""; T("out").textContent = "";
    await refreshToken(t.address); renderDetail(); renderList(); await refreshTrade();
  } catch (err) {
    status(msg, friendlyError(err), "bad");
  } finally { btn.disabled = false; }
});

// ---------------------------------------------------------------- create
$("[data-create]").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.currentTarget, msg = $("[data-c=msg]"), btn = $("[data-c=go]");
  if (!state.address) { connect().catch((err) => status(msg, friendlyError(err), "bad")); return; }
  const name = f.name.value.trim(), symbol = f.symbol.value.trim().replace(/^\$/, "").toUpperCase();
  if (!name || !symbol) { status(msg, "Name and ticker are required.", "bad"); return; }
  const image = f.image.value.trim(), link = f.link.value.trim();
  if ((image && !safeUrl(image)) || (link && !safeUrl(link))) { status(msg, "Links must start with https://", "bad"); return; }
  const meta = JSON.stringify({ description: f.description.value.trim(), ...(image ? { image } : {}), ...(link ? { link } : {}) });
  const buyAmt = amountOf(f.buy.value);
  btn.disabled = true;
  try {
    const cFee = await read("createFee");
    const need = cFee + buyAmt;
    if (need > 0n) {
      const have = await read("balanceOf", [state.address], LAUNCHPAD.quote, erc20);
      if (have < need) throw new Error(`You need ${fmt(need, 4)} ${SYM} for this.`);
      await approveIfNeeded(LAUNCHPAD.quote, need, msg, SYM);
    }
    status(msg, "Confirm the new token in your wallet…");
    const r = await write(L3.id, { address: PAD, abi: padAbi, functionName: "create", args: [name, symbol, meta, buyAmt, 0n, deadline()] }, () => status(msg, "Creating on ANT CHAIN…"));
    let created = null;
    for (const lg of r.logs) {
      if (lg.address.toLowerCase() !== PAD.toLowerCase()) continue;
      try { const ev = decodeEventLog({ abi: [Launched], data: lg.data, topics: lg.topics }); created = getAddress(ev.args.token); } catch { /* other event */ }
    }
    status(msg, created ? `Created $${symbol} at ${short(created)}.` : "Created.", "ok");
    f.reset();
    await loadAll();
    if (created) select(created).catch(warn);
  } catch (err) {
    status(msg, friendlyError(err), "bad");
  } finally { btn.disabled = false; }
});

// ---------------------------------------------------------------- faucet (testnet)
$("[data-drip]")?.addEventListener("click", async () => {
  const msg = $("[data-drip-msg]");
  if (!state.address) { connect().catch((err) => status(msg, friendlyError(err), "bad")); return; }
  try {
    status(msg, "Confirm in your wallet…");
    await write(L3.id, { address: LAUNCHPAD.quote, abi: erc20, functionName: "drip" }, () => status(msg, "Sent. Waiting for ANT CHAIN…"));
    status(msg, `100,000 ${SYM} added to your wallet.`, "ok");
    refreshTrade().catch(warn);
  } catch (err) { status(msg, /Cooldown|0x/i.test(String(err?.message)) ? "Already claimed today. Try again tomorrow." : friendlyError(err), "bad"); }
});

// ---------------------------------------------------------------- start
async function start() {
  read("feeBps").then((f) => { feeBps = BigInt(f); $$("[data-lp-fee]").forEach((el) => { el.textContent = `${Number(f) / 100}%`; }); }).catch(warn);
  read("createFee").then((c) => { $$("[data-lp-cfee]").forEach((el) => { el.textContent = c ? `${fmt(c, 2)} ${SYM}` : "none"; }); }).catch(warn);
  try { await loadAll(); } catch (e) { $("[data-lp-list]").replaceChildren(Object.assign(document.createElement("li"), { className: "empty", textContent: `Could not read the launchpad: ${friendlyError(e)}` })); return; }
  const q = new URLSearchParams(location.search).get("t");
  if (q && isAddress(q) && tokens.has(getAddress(q))) select(getAddress(q), false).catch(warn);
  else if (tokens.size) select([...tokens.values()].sort((x, y) => y.order - x.order)[0].address, false).catch(warn);
  onWallet(() => { refreshTrade().catch(warn); });
  setInterval(() => {
    if (document.hidden) return;
    loadAll().then(() => { if (selected) { renderDetail(); previewTrade().catch(warn); } }).catch(warn);
  }, 15_000);
}
void feeBps;

onWallet((s) => { $$("[data-connect]").forEach((b) => { b.textContent = s.address ? short(s.address) : "Connect wallet"; }); paintButtons(); });
$$("[data-connect]").forEach((b) => b.addEventListener("click", () => connect().catch((e) => alert(friendlyError(e)))));

if (!PAD) {
  $("[data-lp-pending]").hidden = false;
} else {
  $("[data-lp-app]").hidden = false;
  $("[data-lp-addr]").textContent = PAD;
  if (LAUNCHPAD.faucet) $("[data-lp-faucet]").hidden = false;
  start().catch(warn);
}
