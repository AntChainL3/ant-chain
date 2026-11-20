// Shared setup: network selection, env, DNS workaround, viem clients.
//
// NETWORK=mainnet  Robinhood Chain (4663), real ANT as gas, keys from ../.env.mainnet
// NETWORK=fork     local Anvil fork of Robinhood Chain mainnet (free rehearsal), keys from ../.env.mainnet
// NETWORK=testnet  Robinhood Chain Testnet (46630), tANT as gas, keys from ../.env
import { config } from "dotenv";
import https from "node:https";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import readline from "node:readline/promises";
import { Agent, setGlobalDispatcher } from "undici";
import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, "..");

const flag = process.argv.find((a) => ["--mainnet", "--fork", "--testnet"].includes(a));
export const NETWORK = process.env.NETWORK || (flag ? flag.slice(2) : "testnet");
if (!["mainnet", "fork", "testnet"].includes(NETWORK)) throw new Error(`Unknown NETWORK=${NETWORK}`);
const usesMainnetKeys = NETWORK !== "testnet";
config({ path: path.resolve(ROOT, "..", usesMainnetKeys ? ".env.mainnet" : ".env"), quiet: true });

// ---------- DNS-over-HTTPS (some ISPs hijack *.robinhood.com, even plain UDP to 1.1.1.1) ----------
const dohCache = new Map();
function dohResolve(hostname) {
  if (hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return Promise.resolve([hostname === "localhost" ? "127.0.0.1" : hostname]);
  const hit = dohCache.get(hostname);
  if (hit && hit.expires > Date.now()) return Promise.resolve(hit.addrs);
  return new Promise((resolve, reject) => {
    https
      .get(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`,
        { headers: { accept: "application/dns-json" }, timeout: 10_000 },
        (res) => {
          let body = "";
          res.on("data", (c) => (body += c));
          res.on("end", () => {
            try {
              const answers = (JSON.parse(body).Answer || []).filter((a) => a.type === 1);
              if (!answers.length) return reject(new Error(`DoH: no A record for ${hostname}`));
              const addrs = answers.map((a) => a.data);
              const ttl = Math.max(30, Math.min(...answers.map((a) => a.TTL)));
              dohCache.set(hostname, { addrs, expires: Date.now() + ttl * 1000 });
              resolve(addrs);
            } catch (e) {
              reject(e);
            }
          });
        },
      )
      .on("error", reject);
  });
}
setGlobalDispatcher(
  new Agent({
    connect: {
      lookup(hostname, opts, cb) {
        dohResolve(hostname).then(
          (addrs) => (opts && opts.all ? cb(null, addrs.map((a) => ({ address: a, family: 4 }))) : cb(null, addrs[0], 4)),
          (err) => cb(err),
        );
      },
    },
  }),
);

// ---------- chains ----------
const rhMainnet = defineChain({
  id: 4663,
  network: "robinhood-chain",
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.mainnet.chain.robinhood.com"] },
    public: { http: ["https://rpc.mainnet.chain.robinhood.com"] },
  },
  blockExplorers: { default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" } },
  // Arbitrum chains ignore priority fees; Robinhood Chain RPCs report 0. Anvil forks default
  // to 1 gwei, which would make the rehearsal behave unlike mainnet, so pin it to 0.
  fees: { defaultPriorityFee: 0n },
});
const rhTestnet = defineChain({
  id: 46630,
  network: "robinhood-chain-testnet",
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.chain.robinhood.com"] },
    public: { http: ["https://rpc.testnet.chain.robinhood.com"] },
  },
  blockExplorers: { default: { name: "Blockscout", url: "https://explorer.testnet.chain.robinhood.com" } },
  testnet: true,
});

// ---------- per-network settings ----------
export const ANT_TOKEN = "0xbbB6c29bCc3a1028A2B54310DF73F4F7A3bcB373"; // verified on-chain 2026-11-20
export const FORK_RPC = "http://127.0.0.1:8545";
export const erc20Abi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "v", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "s", type: "address" }, { name: "v", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "o", type: "address" }, { name: "s", type: "address" }], outputs: [{ type: "uint256" }] },
];

// Chainlink ETH/USD on Robinhood Chain mainnet, verified on-chain 2026-11-20 ("ETH / USD", 8 decimals).
export const CHAINLINK_ETH_USD_MAINNET = "0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9";

const SETTINGS = {
  mainnet: { parentChain: rhMainnet, rpc: process.env.PARENT_RPC || rhMainnet.rpcUrls.default.http[0], chainId: 26800, chainName: "ANT CHAIN", nativeToken: ANT_TOKEN, ethUsdFeed: CHAINLINK_ETH_USD_MAINNET, deploymentFile: "deployment.mainnet.json" },
  fork: { parentChain: rhMainnet, rpc: FORK_RPC, chainId: 26800, chainName: "ANT CHAIN (fork rehearsal)", nativeToken: ANT_TOKEN, ethUsdFeed: CHAINLINK_ETH_USD_MAINNET, deploymentFile: "deployment.fork.json" },
  testnet: { parentChain: rhTestnet, rpc: process.env.PARENT_RPC || rhTestnet.rpcUrls.default.http[0], chainId: 26801, chainName: "ANT CHAIN Testnet", nativeToken: null, ethUsdFeed: process.env.TESTNET_ETH_USD_FEED || null, deploymentFile: "deployment.testnet.json" },
};
export const S = SETTINGS[NETWORK];
export const CHAIN_ID = S.chainId;
export const CHAIN_NAME = S.chainName;
export const parentChain = S.parentChain;

const transport = http(S.rpc, { timeout: 120_000 });
export const parentPublicClient = createPublicClient({ chain: parentChain, transport });

export function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} in ${usesMainnetKeys ? ".env.mainnet" : ".env"}`);
  return v;
}
export function account(role) {
  return privateKeyToAccount(env(`${role}_PRIVATE_KEY`));
}
export function walletClient(role) {
  return createWalletClient({ chain: parentChain, transport, account: account(role) });
}

// ---------- deployment record ----------
const DEPLOYMENT = path.join(ROOT, S.deploymentFile);
export function loadDeployment() {
  return existsSync(DEPLOYMENT) ? JSON.parse(readFileSync(DEPLOYMENT, "utf8")) : {};
}
export function saveDeployment(patch) {
  const next = { ...loadDeployment(), ...patch };
  writeFileSync(DEPLOYMENT, JSON.stringify(next, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));
  return next;
}

// ---------- safety ----------
// Every script that sends mainnet transactions calls this first.
export async function confirmMainnet(action) {
  if (NETWORK !== "mainnet") return;
  const fork = loadForkRehearsal();
  if (!fork.passed) throw new Error("Mainnet is locked until the fork rehearsal passes. Run: npm run rehearse");
  console.log(`\n*** MAINNET *** ${action}\nThis spends real ETH/ANT and cannot be undone.`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('Type "deploy mainnet" to continue: ');
  rl.close();
  if (answer.trim() !== "deploy mainnet") throw new Error("Aborted.");
}
const REHEARSAL = path.join(ROOT, "rehearsal.json");
export function loadForkRehearsal() {
  return existsSync(REHEARSAL) ? JSON.parse(readFileSync(REHEARSAL, "utf8")) : {};
}
export function saveForkRehearsal(r) {
  writeFileSync(REHEARSAL, JSON.stringify(r, null, 2));
}
