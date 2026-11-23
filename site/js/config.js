// ANT CHAIN public configuration. Addresses only, never keys.
// Two profiles; ACTIVE picks the one the apps use. Mainnet is live; testnet stays open for trying things with free tokens.
const PROFILES = {
  testnet: {
    NETWORK: "testnet",
    TOKEN: "tANT",
    L3: { id: 26801, hex: "0x68b1", name: "ANT CHAIN Testnet", rpc: "https://rpc.testnet.antchain.tech" },
    L2: { id: 46630, hex: "0xb626", name: "Robinhood Chain Testnet", rpcs: ["https://antchain.tech/rpc/rh-testnet", "https://website-production-ec713a93.up.railway.app/rpc/rh-testnet", "https://rpc.testnet.chain.robinhood.com"], walletRpc: "https://antchain.tech/rpc/rh-testnet" },
    ADDR: {
      ant: "0xbf10d827020a5f4260e27a005ae0034d97514b17", // tANT, valueless test token with a public faucet
      inbox: "0xc49C0f0faFAB36A5Fe5c2098dEDf958afe3e0730",
      bridge: "0x8d3A8e6E0938009ba6d46E9904E7B367Ef290682",
      outbox: "0x2098519c82D56df147e3EE73886B840026431259",
      rollup: "0xe5336CD5C0A0a9f26967FB4C2F14a8F1109Cd62D",
      sequencerInbox: "0x6908E358ff65aed84c44C3Df699262f5B6CBD151",
      pricer: "0x545328faa9c28fda8d9c1d23ad4bd32f52b2daa7",
      validator: "0x08d03d05ffe87bE0f234af772Dea69Af98895d59",
      arbSys: "0x0000000000000000000000000000000000000064",
      nodeInterface: "0x00000000000000000000000000000000000000C8",
    },
    DEX: { wrappedAnt: "0xCaab57bf6F4AC057E2024C5778000fb377372548", factory: "0xc90CdDc8B6bC5c1724e10Ccb161d89e12f162Af2", router: "0x2Db8b8200a474F47640f16dB66C0089169b6FDaa", testUsd: "0xA020932FB3D16836B0B8741370a5D4B123eEc43c" },
    CONFIRM_BLOCKS: 150, // ~30 minutes of 12 s Ethereum blocks
  },
  mainnet: {
    NETWORK: "mainnet",
    TOKEN: "ANT",
    L3: { id: 26800, hex: "0x68b0", name: "ANT CHAIN", rpc: "https://rpc.antchain.tech" },
    L2: { id: 4663, hex: "0x1237", name: "Robinhood Chain", rpcs: ["https://robinhood.drpc.org", "https://rpc.mainnet.chain.robinhood.com"], walletRpc: "https://rpc.mainnet.chain.robinhood.com" },
    ADDR: {
      ant: "0xbbB6c29bCc3a1028A2B54310DF73F4F7A3bcB373",
      inbox: "0x13be8403DdeA7826a6f46904344d4a9431c28Efa",
      bridge: "0x3c7218E4E7a0819C3C83065d030BB3502AE76F1a",
      outbox: "0x745Eb8C2CF6B643d25f4391d3D6C92C318a63CA3",
      rollup: "0xe3A87D0cDA39c335cb2Bbaf4DE1f052fe41aeE06",
      sequencerInbox: "0xCBD854bbAf1580123cE9f7DF5bac3bFc6C33bf9E",
      pricer: "0x87b35eb0ed8724250126fd16ba3c1f3509eeb2ab",
      validator: "0x98136b570891de44dAfeC819491b7a5A546faC1E",
      arbSys: "0x0000000000000000000000000000000000000064",
      nodeInterface: "0x00000000000000000000000000000000000000C8",
    },
    DEX: { wrappedAnt: "0xf4dc96b75d44EE74a6a4Ea59004aa9f8AF4C1Bb4", factory: "0xF7ba8FDa62e031252151D3c5b6F05C1dbA05459A", router: "0x3Cd343c668cCBaEaE01326ffc721C840A1A1BefF", testUsd: null }, // deployed 22 Nov 2026
    CONFIRM_BLOCKS: 50400, // about 7 days of 12 s Ethereum blocks
  },
};

export { PROFILES };
// true: mainnet is open to users. false: it runs but is not announced, and the site stays on testnet.
export const MAINNET_OPEN = true;
// Which network the apps use. Mainnet by default once open; ?net=testnet (remembered per browser) switches.
function pickNetwork() {
  if (!MAINNET_OPEN) return "testnet";
  // the explorer's network is in its URL: /explorer/... is mainnet, /explorer/testnet/... is testnet
  if (typeof location !== "undefined" && /^\/explorer(\/|$)/.test(location.pathname)) return /^\/explorer\/testnet(\/|$)/.test(location.pathname) ? "testnet" : "mainnet";
  let net = null;
  try {
    const q = new URLSearchParams(location.search).get("net");
    if (q === "mainnet" || q === "testnet") { net = q; localStorage.setItem("antchain.net", q); }
    else net = localStorage.getItem("antchain.net");
  } catch { /* storage blocked: use the default */ }
  return net === "testnet" ? "testnet" : "mainnet";
}
export const ACTIVE = pickNetwork();

// $ANTC staking for gas credits. It lives on Robinhood Chain (where $ANTC trades on Pons), independent of ACTIVE.
// Until $ANTC exists, the page runs in test mode: tANT stands in for $ANTC on Robinhood Chain Testnet.
// At launch: deploy with `ANTC_TOKEN=0x... node scripts/06-antc-staking.js --mainnet`, then switch this block to mainnet.
export const STAKING = {
  test: false,
  chain: { id: 4663, hex: "0x1237", name: "Robinhood Chain", rpcs: PROFILES.mainnet.L2.rpcs, walletRpc: "https://robinhood.drpc.org" },
  contract: "0xfd0d05df472a932e6bc64ca34744c77fd3c7b1ac",
  token: "0x1A9ca5A347c4aeAb4870668E76506E45C23D6281", // $ANTC
  symbol: "ANTC",
  buyUrl: "https://ponsfamily.com/launchpad/0x1A9ca5A347c4aeAb4870668E76506E45C23D6281", // $ANTC on Pons
};
const P = PROFILES[ACTIVE];
export const NETWORK = P.NETWORK;
export const TOKEN = P.TOKEN;
export const L3 = P.L3;
export const L2 = P.L2;
export const ADDR = P.ADDR;
export const DEX = P.DEX;
export const CONFIRM_BLOCKS = P.CONFIRM_BLOCKS;
// Where the site reads the live ANT price: the MAINNET fee pricer on Robinhood Chain, kept in line with the
// market by the keeper. Read-only, so it works in testnet mode without opening ANT CHAIN mainnet.
export const PRICE_SOURCE = { pricer: PROFILES.mainnet.ADDR.pricer, rpcs: PROFILES.mainnet.L2.rpcs };
export const VIEM ="https://cdn.jsdelivr.net/npm/viem@2.21.60/+esm";

// WalletConnect Cloud project id (cloud.reown.com). Empty = browser wallets only in the RainbowKit modal.
export const WALLETCONNECT_PROJECT_ID = "f654849c063f77ee18b8da47a1475593";
