// $ANTC bridge: Robinhood Chain <-> ANT CHAIN through the standard Arbitrum token gateway.
// In:  approve $ANTC and a small ANT fee to the gateway, then L1OrbitGatewayRouter.outboundTransferCustomRefund
//      addressed to the wallet itself (so smart accounts are credited correctly). Unused fee is refunded.
// Out: L2GatewayRouter.outboundTransfer on ANT CHAIN; the claim appears in "Your withdrawals" after ~7 days.
import { ANTC_BRIDGE, ADDR, L2, L3 } from "./config.js";
import { viem, l2, l3, state, onWallet, connect, write, friendlyError, fmt, short } from "./wallet.js";

const warn = (e) => console.warn(e);
const { parseAbi, parseUnits, encodeAbiParameters } = viem;
const $ = (s, r = document) => r.querySelector(s);
const card = $("[data-antc]");
const MAX_GAS = 2_000_000n; // the first deposit also deploys $ANTC on ANT CHAIN (~535k gas measured)

const erc20 = parseAbi(["function balanceOf(address) view returns (uint256)", "function allowance(address,address) view returns (uint256)", "function approve(address,uint256) returns (bool)"]);
const l2RouterAbi = parseAbi(["function outboundTransferCustomRefund(address _token, address _refundTo, address _to, uint256 _amount, uint256 _maxGas, uint256 _gasPriceBid, bytes _data) payable returns (bytes)"]);
const l3RouterAbi = parseAbi(["function outboundTransfer(address _l1Token, address _to, uint256 _amount, bytes _data) payable returns (bytes)"]);

const status = (el, text, kind = "") => { el.textContent = text; el.dataset.kind = kind; };
const amountOf = (v) => { try { const a = parseUnits(String(v || "").trim().replace(",", "."), 18); return a > 0n ? a : 0n; } catch { return 0n; } };
let dir = "in";
const bal = { l2: 0n, l3: 0n, ant: 0n };

async function l3Balance(a) {
  const code = await l3.getBytecode({ address: ANTC_BRIDGE.l3Token }).catch(() => null);
  if (!code || code === "0x") return 0n; // created by the first deposit
  return l3.readContract({ address: ANTC_BRIDGE.l3Token, abi: erc20, functionName: "balanceOf", args: [a] });
}
async function refresh() {
  if (!state.address) { $("[data-antc-bal]", card).textContent = "—"; $("[data-antc-other]", card).textContent = "—"; paint(); return; }
  const a = state.address;
  const [x, y, z] = await Promise.all([
    l2.readContract({ address: ANTC_BRIDGE.l2Token, abi: erc20, functionName: "balanceOf", args: [a] }).catch(() => 0n),
    l3Balance(a).catch(() => 0n),
    l2.readContract({ address: ADDR.ant, abi: erc20, functionName: "balanceOf", args: [a] }).catch(() => 0n),
  ]);
  Object.assign(bal, { l2: x, l3: y, ant: z });
  $("[data-antc-bal]", card).textContent = `${fmt(dir === "in" ? x : y, 2)} $ANTC`;
  $("[data-antc-other]", card).textContent = `${fmt(dir === "in" ? y : x, 2)} $ANTC`;
  paint();
}
function paint() {
  $("[data-antc-from]", card).textContent = dir === "in" ? "Robinhood Chain" : "ANT CHAIN";
  $("[data-antc-to]", card).textContent = dir === "in" ? "ANT CHAIN" : "Robinhood Chain";
  $("[data-antc-note]", card).textContent = dir === "in"
    ? "Arrives in about a minute. Needs a little ANT on Robinhood Chain for the ticket (about 0.0004 ANT, unused part refunded) and ETH for gas."
    : "Claim on Robinhood Chain after about 7 days, from “Your withdrawals” on this page. Gas is paid in ANT on ANT CHAIN.";
  $("[data-antc-go]", card).textContent = !state.address ? "Connect wallet" : dir === "in" ? "Bridge $ANTC to ANT CHAIN" : "Withdraw $ANTC to Robinhood Chain";
}

async function deposit(amount, msg) {
  const me = state.address;
  if (amount > bal.l2) throw new Error("Not enough $ANTC on Robinhood Chain.");
  const gp = await l3.getGasPrice();
  const bid = gp * 2n, fee = MAX_GAS * bid;
  if (bal.ant < fee) throw new Error(`You need ${fmt(fee, 6)} ANT on Robinhood Chain for the bridge ticket.`);
  const allowA = await l2.readContract({ address: ANTC_BRIDGE.l2Token, abi: erc20, functionName: "allowance", args: [me, ANTC_BRIDGE.l2Gateway] });
  if (allowA < amount) {
    status(msg, "Approve $ANTC for the bridge in your wallet…");
    await write(L2.id, { address: ANTC_BRIDGE.l2Token, abi: erc20, functionName: "approve", args: [ANTC_BRIDGE.l2Gateway, amount] }, () => status(msg, "Approval sent. Waiting for Robinhood Chain…"));
  }
  const allowF = await l2.readContract({ address: ADDR.ant, abi: erc20, functionName: "allowance", args: [me, ANTC_BRIDGE.l2Gateway] });
  if (allowF < fee) {
    status(msg, "Approve the ANT ticket fee in your wallet…");
    await write(L2.id, { address: ADDR.ant, abi: erc20, functionName: "approve", args: [ANTC_BRIDGE.l2Gateway, fee] }, () => status(msg, "Approval sent. Waiting for Robinhood Chain…"));
  }
  const before = await l3Balance(me).catch(() => 0n);
  status(msg, "Confirm the bridge in your wallet…");
  const data = encodeAbiParameters([{ type: "uint256" }, { type: "bytes" }, { type: "uint256" }], [0n, "0x", fee]);
  await write(L2.id, { address: ANTC_BRIDGE.l2Router, abi: l2RouterAbi, functionName: "outboundTransferCustomRefund", args: [ANTC_BRIDGE.l2Token, me, me, amount, MAX_GAS, bid, data] }, () => status(msg, "Sent. Waiting for Robinhood Chain…"));
  status(msg, "Locked on Robinhood Chain. Waiting for ANT CHAIN (usually under a minute)…");
  const t0 = Date.now();
  while (Date.now() - t0 < 15 * 60_000) {
    await new Promise((r) => setTimeout(r, 5000));
    const now = await l3Balance(me).catch(() => before);
    if (now > before) { status(msg, `Done. ${fmt(now - before, 2)} $ANTC arrived on ANT CHAIN.`, "ok"); return; }
  }
  status(msg, "Locked on Robinhood Chain; it will arrive on ANT CHAIN when the sequencer picks it up. You do not need to do anything.", "warn");
}

async function withdraw(amount, msg) {
  if (amount > bal.l3) throw new Error("Not enough $ANTC on ANT CHAIN.");
  status(msg, "Confirm the withdrawal in your wallet…");
  await write(L3.id, { address: ANTC_BRIDGE.l3Router, abi: l3RouterAbi, functionName: "outboundTransfer", args: [ANTC_BRIDGE.l2Token, state.address, amount, "0x"] }, () => status(msg, "Sent. Waiting for ANT CHAIN…"));
  status(msg, "Withdrawal started. It is listed under “Your withdrawals”; claim it on Robinhood Chain after about 7 days.", "ok");
  document.dispatchEvent(new CustomEvent("antchain:withdrawals"));
}

if (card && ANTC_BRIDGE) {
  card.hidden = false;
  card.querySelectorAll("[data-antc-dir]").forEach((b) => b.addEventListener("click", () => {
    dir = b.dataset.antcDir;
    card.querySelectorAll("[data-antc-dir]").forEach((x) => { const on = x === b; x.setAttribute("aria-selected", String(on)); x.tabIndex = on ? 0 : -1; });
    status($("[data-antc-msg]", card), "");
    refresh().catch(warn);
  }));
  $("[data-antc-max]", card).addEventListener("click", () => { $("[data-antc-amt]", card).value = viem.formatUnits(dir === "in" ? bal.l2 : bal.l3, 18); });
  $("[data-antc-form]", card).addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("[data-antc-msg]", card), btn = $("[data-antc-go]", card);
    if (!state.address) { connect().catch((err) => status(msg, friendlyError(err), "bad")); return; }
    const amount = amountOf($("[data-antc-amt]", card).value);
    if (!amount) { status(msg, "Enter an amount.", "bad"); return; }
    btn.disabled = true;
    try {
      await (dir === "in" ? deposit(amount, msg) : withdraw(amount, msg));
      $("[data-antc-amt]", card).value = "";
    } catch (err) { status(msg, friendlyError(err), "bad"); }
    finally { btn.disabled = false; refresh().catch(warn); }
  });
  onWallet(() => { refresh().catch(warn); });
  setInterval(() => { if (!document.hidden) refresh().catch(warn); }, 20_000);
}
void short;
