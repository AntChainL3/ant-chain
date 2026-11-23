// Fills network-specific labels on every page from config.js, so one page works for mainnet and testnet.
//   data-n="l2|l2id|l3|l3id|tok|net|rpc|strip"  text from the active profile
//   data-show="mainnet|testnet"                   shown only on that network
//   data-net-switch                               Mainnet / Testnet toggle (links with ?net=)
//   data-explorer links and links to /explorer/testnet/... point at the explorer of the active network
import { PROFILES, ACTIVE, MAINNET_OPEN } from "./config.js";

const P = PROFILES[ACTIVE];
const SHORT_L2 = { mainnet: "Robinhood Chain", testnet: "Robinhood Testnet" };
const TEXT = {
  l2: SHORT_L2[ACTIVE],
  l2id: String(P.L2.id),
  l3: P.L3.name,
  l3id: String(P.L3.id),
  tok: P.TOKEN,
  net: ACTIVE,
  NET: ACTIVE.toUpperCase(),
  netlive: `${ACTIVE} live`,
  route: `${SHORT_L2[ACTIVE]} (${P.L2.id}) → ${P.L3.name} (${P.L3.id})`,
  rpc: P.L3.rpc.replace("https://", ""),
  strip: ACTIVE === "mainnet" ? "Mainnet live · gas paid in ANT" : "Testnet · test tokens have no value",
};

function apply() {
  document.querySelectorAll("[data-n]").forEach((el) => { const t = TEXT[el.dataset.n]; if (t !== undefined) el.textContent = t; });
  document.querySelectorAll("[data-show]").forEach((el) => { el.hidden = el.dataset.show !== ACTIVE; });
  document.querySelectorAll(".brand-net").forEach((el) => { el.textContent = ACTIVE; });
  // explorer links follow the active network: in the menus (data-explorer) and in live-data links
  const exBase = ACTIVE === "mainnet" ? "/explorer" : "/explorer/testnet";
  document.querySelectorAll("a[data-explorer]").forEach((a) => { a.setAttribute("href", `${exBase}/`); });
  if (ACTIVE === "mainnet") {
    document.querySelectorAll('a[href^="/explorer/testnet"]').forEach((a) => {
      if (a.closest("[data-keep-net]")) return;
      a.setAttribute("href", a.getAttribute("href").replace("/explorer/testnet", "/explorer"));
    });
  }
  document.querySelectorAll("[data-net-switch]").forEach((box) => {
    if (!MAINNET_OPEN) { box.hidden = true; return; }
    box.replaceChildren(...["mainnet", "testnet"].map((net) => {
      const a = document.createElement("a");
      const u = new URL(location.href); u.searchParams.set("net", net);
      a.href = u.pathname + u.search + u.hash;
      a.textContent = net === "mainnet" ? "Mainnet" : "Testnet";
      if (net === ACTIVE) { a.className = "on"; a.setAttribute("aria-current", "true"); }
      return a;
    }));
  });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply); else apply();
