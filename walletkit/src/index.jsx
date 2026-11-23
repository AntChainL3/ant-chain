// RainbowKit wallet modal for the ANT CHAIN site (bundled with esbuild into site/js/walletkit.js).
// The vanilla pages talk to it through window.antWallet:
//   antWallet.open()        connect modal, or the account modal when already connected
//   antWallet.provider      EIP-1193 provider of the connected wallet (null when disconnected)
//   antWallet.address / chainId
//   window event "antwallet:change" fires on every connect, disconnect, account or network change
import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { RainbowKitProvider, darkTheme, connectorsForWallets, useConnectModal, useAccountModal } from "@rainbow-me/rainbowkit";
import { metaMaskWallet, rabbyWallet, coinbaseWallet, injectedWallet, walletConnectWallet, rainbowWallet, trustWallet } from "@rainbow-me/rainbowkit/wallets";
import { WagmiProvider, createConfig, http, useAccount } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { defineChain } from "viem";
import { PROFILES, ACTIVE, WALLETCONNECT_PROJECT_ID } from "../config.js";

const P = PROFILES[ACTIVE];
const l3 = defineChain({
  id: P.L3.id, name: P.L3.name,
  nativeCurrency: { name: P.TOKEN, symbol: P.TOKEN, decimals: 18 },
  rpcUrls: { default: { http: [P.L3.rpc] } },
  blockExplorers: { default: { name: "ANT CHAIN Explorer", url: `${location.origin}${ACTIVE === "testnet" ? "/explorer/testnet" : "/explorer"}` } },
  testnet: ACTIVE === "testnet",
});
const l2 = defineChain({
  id: P.L2.id, name: P.L2.name,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [P.L2.walletRpc] } },
  testnet: ACTIVE === "testnet",
});

// Mobile wallets (QR / WalletConnect) need a WalletConnect Cloud project id; without it only browser wallets are offered.
const hasWC = typeof WALLETCONNECT_PROJECT_ID === "string" && WALLETCONNECT_PROJECT_ID.length >= 32;
const projectId = hasWC ? WALLETCONNECT_PROJECT_ID : "00000000000000000000000000000000";
const groups = [{ groupName: "Browser wallets", wallets: hasWC ? [metaMaskWallet, rabbyWallet, coinbaseWallet, injectedWallet] : [injectedWallet, metaMaskWallet, rabbyWallet, coinbaseWallet] }];
if (hasWC) groups.push({ groupName: "Mobile", wallets: [walletConnectWallet, rainbowWallet, trustWallet] });
const connectors = connectorsForWallets(groups, {
  appName: "ANT CHAIN", projectId,
  appDescription: "Layer 3 on Robinhood Chain. Gas is paid in the ANT Stock Token.",
  appUrl: location.origin, appIcon: `${location.origin}/icon.png`,
});

const config = createConfig({
  connectors,
  chains: [l2, l3],
  transports: { [l2.id]: http(P.L2.rpcs[0]), [l3.id]: http(P.L3.rpc) },
  ssr: false,
});
const queryClient = new QueryClient();

const api = { provider: null, address: null, chainId: null, open: () => {} };
window.antWallet = api;

function Bridge() {
  const { address, chainId, connector, status } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();
  useEffect(() => {
    api.open = () => (address ? openAccountModal?.() : openConnectModal?.());
  }, [address, openConnectModal, openAccountModal]);
  useEffect(() => {
    let alive = true;
    (async () => {
      const provider = address && connector ? await connector.getProvider().catch(() => null) : null;
      if (!alive) return;
      api.provider = provider; api.address = address || null; api.chainId = chainId || null; api.status = status;
      window.dispatchEvent(new CustomEvent("antwallet:change", { detail: { address: api.address, chainId: api.chainId, status } }));
    })().catch((e) => console.warn(e));
    return () => { alive = false; };
  }, [address, chainId, connector, status]);
  return null;
}

const theme = darkTheme({ accentColor: "#ffb21a", accentColorForeground: "#0a0a0a", borderRadius: "medium", overlayBlur: "small", fontStack: "system" });
theme.colors.modalBackground = "#111111";
theme.colors.modalBorder = "rgba(255,255,255,.1)";
theme.fonts.body = "Geist, 'Segoe UI', system-ui, sans-serif";

const mount = document.createElement("div");
mount.id = "antwallet-root";
document.body.appendChild(mount);
createRoot(mount).render(
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider theme={theme} initialChain={l2} modalSize="compact" appInfo={{ appName: "ANT CHAIN", learnMoreUrl: `${location.origin}/docs/` }}>
        <Bridge />
      </RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>,
);
window.dispatchEvent(new Event("antwallet:ready"));

// viem for the vanilla pages, so they do not fetch a second copy from a CDN
export * as viem from "viem";
