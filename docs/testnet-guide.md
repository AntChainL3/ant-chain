# Testnet guide

Everything on ANT CHAIN Testnet is free and uses test tokens with no value. This guide walks through the full flow: get test tokens, bridge them in, trade, and withdraw back. It takes about five minutes, plus about an hour of waiting for the withdrawal at the end.

## Before you start

- A browser wallet (MetaMask, Rabby, Coinbase Wallet) or a mobile wallet that supports WalletConnect.
- Nothing else. You do not need ETH or any other faucet; the test kit covers it.

You will use two networks. The site adds them to your wallet for you when needed:

| | Robinhood Chain Testnet | ANT CHAIN Testnet |
|---|---|---|
| Role | parent chain, where tANT lives before you bridge it | the chain you use |
| Chain ID | 46630 | 26801 |
| Gas | testnet ETH | tANT |

## 1. Connect your wallet

Open [antchain.tech/bridge](https://antchain.tech/bridge/) and press **Connect wallet**. Pick your wallet from the list (mobile wallets: choose WalletConnect and scan the QR code).

## 2. Get a test kit

On the bridge page, under **Testnet faucet**, press **Get test kit**. Within a few seconds you receive on Robinhood Chain Testnet:

- **100 tANT**, the testnet gas token ([what is tANT?](tant.md)), and
- a little **testnet ETH**, enough to pay for your deposit transaction there (only sent if your wallet is short).

One kit per wallet every 24 hours. If you already have testnet ETH, **Claim 100 tANT on chain** does the same for tANT only.

## 3. Deposit tANT into ANT CHAIN

On the **Deposit** tab, type an amount (or press **Max**) and press **Deposit**. Your wallet asks you to sign twice:

1. **Approve**: lets the ANT CHAIN inbox move that much tANT.
2. **Deposit**: locks the tANT in the bridge on Robinhood Chain Testnet.

The progress bar shows *Approve, Deposit, Lock on Robinhood Chain, Credited on ANT CHAIN*. The same amount arrives on ANT CHAIN Testnet as your gas balance, usually within a minute.

## 4. Add ANT CHAIN Testnet to your wallet

Press **Add network** on the bridge page (or **Add to wallet** on the home page). Your wallet now shows your tANT balance on ANT CHAIN Testnet. You can also add it by hand:

| Field | Value |
|---|---|
| Network name | ANT CHAIN Testnet |
| RPC URL | `https://rpc.testnet.antchain.tech` |
| Chain ID | `26801` |
| Currency symbol | `tANT` |
| Block explorer | `https://antchain.tech/explorer/testnet` |

## 5. Swap and provide liquidity

Open [antchain.tech/swap](https://antchain.tech/swap/).

- **Swap**: trade tANT for tUSD (or back). Pick a slippage tolerance, review the quote, and confirm. Gas is paid in tANT.
- **Pool**: add tANT and tUSD to the pool to earn the 0.3% trading fee as a liquidity provider, or remove your liquidity later. Need tUSD? Swap some tANT for it first, or call `drip()` on the tUSD contract for 10,000 tUSD a day.

Every transaction appears on the [explorer](https://antchain.tech/explorer/testnet/).

## 6. Withdraw back to Robinhood Chain

On the bridge page, open the **Withdraw** tab, type an amount and press **Withdraw**. This is a single transaction on ANT CHAIN.

Your withdrawal then appears under **Your withdrawals** with a **countdown**. It needs three things to happen first:

1. the block with your withdrawal is posted to Robinhood Chain in a batch,
2. the validator posts a claim (an *assertion*) that includes it,
3. that claim survives the challenge window (150 Ethereum blocks, about 30 minutes, on testnet).

Altogether this is usually **45 to 60 minutes** on testnet. (On mainnet the window is about **7 days**, the same as Arbitrum One.) When the countdown ends, the status changes to *Finalizing on chain* and then a **Claim** button appears. Press it and confirm in your wallet; your tANT is released on Robinhood Chain Testnet.

You can close the page while you wait. Come back later, connect the same wallet, and your withdrawals are listed again.

## Troubleshooting

| Problem | What to do |
|---|---|
| "This wallet already got a test kit today" | Kits are limited to one per wallet and network every 24 hours. Try again tomorrow, or use the on-chain `drip()` if you have testnet ETH. |
| Deposit fails or asks for more ETH | You need tANT and a little testnet ETH on Robinhood Chain Testnet. Get a test kit first. |
| "Not enough tUSD" when adding liquidity | Swap some tANT to tUSD first, or call `drip()` on tUSD. |
| My deposit has not arrived | Deposits are usually credited within a minute. Check the parent transaction on Robinhood Chain Testnet, then refresh the bridge page. |
| The countdown ended but there is no Claim button | The page shows *Finalizing on chain* while the validator's claim is confirmed. It checks again every minute. |
| Robinhood pages do not load on my network | Some internet providers block `*.robinhood.com`. The site reaches Robinhood Chain Testnet through its own proxy, so the apps keep working. |

## Reminder

tANT, tUSD and testnet ETH have **no value**. Testnet balances are not converted into anything. Never send real assets to testnet addresses.
