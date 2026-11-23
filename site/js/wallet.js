// Shared wallet + RPC helpers for the bridge and swap apps.
// Wallet selection runs through RainbowKit (js/walletkit, window.antWallet); a plain injected wallet is the fallback.
import { L2, L3, VIEM, TOKEN } from "./config.js";

// viem and RainbowKit come from our own bundle (js/walletkit); the CDN copy of viem is only a fallback.
let viemMod = null;
try { viemMod = (await import("./walletkit/index.js")).viem; } catch (e) { console.warn("RainbowKit unavailable, using the injected wallet", e); }
if (!viemMod) viemMod = await import(VIEM);
export const viem = viemMod;
const { createPublicClient, createWalletClient, custom, http, fallback, defineChain } = viem;

export const antChain = defineChain({
  id: L3.id, name: L3.name,
  nativeCurrency: { name: TOKEN, symbol: TOKEN, decimals: 18 },
  rpcUrls: { default: { http: [L3.rpc] } },
});
export const robinhood = defineChain({
  id: L2.id, name: L2.name,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [L2.walletRpc] } },
});

export const l3 = createPublicClient({ chain: antChain, transport: http(L3.rpc, { timeout: 15_000 }) });
export const l2 = createPublicClient({ chain: robinhood, transport: fallback(L2.rpcs.map((u) => http(u, { timeout: 15_000 }))) });

const listeners = new Set();
export const state = { address: null, chainId: null };
export const onWallet = (fn) => { listeners.add(fn); fn(state); };
const emit = () => listeners.forEach((fn) => fn(state));

const kit = () => (typeof window !== "undefined" ? window.antWallet : null);
// the EIP-1193 provider of whichever wallet is connected
const prov = () => kit()?.provider || window.ethereum;
export function hasWallet() { return !!kit() || (typeof window !== "undefined" && !!window.ethereum); }

if (kit()) {
  window.addEventListener("antwallet:change", (e) => {
    const { address, chainId } = e.detail || {};
    state.address = address ? viem.getAddress(address) : null;
    state.chainId = chainId || null;
    emit();
  });
} else if (window.ethereum) {
  window.ethereum.request({ method: "eth_accounts" }).then(async (accs) => {
    if (accs && accs[0]) {
      state.address = viem.getAddress(accs[0]);
      state.chainId = Number.parseInt(await window.ethereum.request({ method: "eth_chainId" }), 16);
      emit();
    }
  }).catch(() => {});
  window.ethereum.on?.("accountsChanged", (accs) => { state.address = accs && accs[0] ? viem.getAddress(accs[0]) : null; emit(); });
  window.ethereum.on?.("chainChanged", (id) => { state.chainId = Number.parseInt(id, 16); emit(); });
}

// Opens the RainbowKit modal (or the account panel when connected) and resolves with the address once connected.
export async function connect() {
  const k = kit();
  if (k) {
    if (state.address) { k.open(); return state.address; }
    k.open();
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { window.removeEventListener("antwallet:change", on); reject(new Error("No wallet connected.")); }, 5 * 60_000);
      function on(e) { if (e.detail?.address) { clearTimeout(t); window.removeEventListener("antwallet:change", on); resolve(viem.getAddress(e.detail.address)); } }
      window.addEventListener("antwallet:change", on);
    });
  }
  if (!window.ethereum) throw new Error("No browser wallet found. Install MetaMask, Rabby or another EVM wallet.");
  const [addr] = await window.ethereum.request({ method: "eth_requestAccounts" });
  state.address = viem.getAddress(addr);
  state.chainId = Number.parseInt(await window.ethereum.request({ method: "eth_chainId" }), 16);
  emit();
  return state.address;
}

const PARAMS = {
  [L3.id]: { chainId: L3.hex, chainName: L3.name, nativeCurrency: { name: TOKEN, symbol: TOKEN, decimals: 18 }, rpcUrls: [L3.rpc] },
  [L2.id]: { chainId: L2.hex, chainName: L2.name, nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: [L2.walletRpc] },
};

export async function ensureChain(id) {
  if (!state.address) await connect();
  const p = prov();
  const current = Number.parseInt(await p.request({ method: "eth_chainId" }), 16);
  if (current === id) return;
  try {
    await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: PARAMS[id].chainId }] });
  } catch (e) {
    if (e && (e.code === 4902 || e.data?.originalError?.code === 4902 || /Unrecognized chain|not been added|unknown chain/i.test(e.message || ""))) {
      await p.request({ method: "wallet_addEthereumChain", params: [PARAMS[id]] });
    } else throw e;
  }
  state.chainId = id;
  emit();
}

export async function addNetwork(id = L3.id) {
  if (!state.address && kit()) await connect();
  const p = prov();
  if (!p) throw new Error("No browser wallet found.");
  await p.request({ method: "wallet_addEthereumChain", params: [PARAMS[id]] });
}

export function walletFor(id) {
  return createWalletClient({ account: state.address, chain: id === L3.id ? antChain : robinhood, transport: custom(prov()) });
}

// Ask the connected wallet to sign a plain text message (free, no transaction, works on any network).
export async function signMessage(message) {
  if (!state.address) throw new Error("Connect a wallet first.");
  const p = prov();
  if (!p) throw new Error("No wallet found.");
  return createWalletClient({ account: state.address, transport: custom(p) }).signMessage({ account: state.address, message });
}

// Send a contract write on chain `id` and wait for the receipt on our own RPC.
export async function write(id, req, onHash) {
  await ensureChain(id);
  const w = walletFor(id);
  const hash = await w.writeContract({ ...req, account: state.address, chain: id === L3.id ? antChain : robinhood });
  onHash?.(hash);
  const client = id === L3.id ? l3 : l2;
  const r = await client.waitForTransactionReceipt({ hash, timeout: 180_000 });
  if (r.status !== "success") throw new Error(`Transaction reverted (${hash.slice(0, 10)}…)`);
  return r;
}

export function friendlyError(e) {
  const m = e?.shortMessage || e?.message || String(e);
  if (e?.code === 4001 || /User rejected|denied/i.test(m)) return "Cancelled in your wallet.";
  if (/insufficient funds/i.test(m)) return "Not enough gas in your wallet for this network.";
  return m.split("\n")[0].slice(0, 220);
}

export const fmt = (wei, dp = 6, decimals = 18) => {
  const s = viem.formatUnits(wei ?? 0n, decimals);
  const [i, f = ""] = s.split(".");
  let t = f.slice(0, dp); while (t.endsWith("0")) t = t.slice(0, -1);
  return Number(i).toLocaleString("en-US") + (t ? "." + t : "");
};
export const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
