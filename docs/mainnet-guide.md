# Using ANT CHAIN mainnet

ANT CHAIN mainnet is live: an Arbitrum chain on Robinhood Chain where every fee is paid in **ANT**, the ANT Stock Token. This guide covers adding the network, bridging ANT in, using it, and withdrawing.

Want to practice first with free tokens? Use testnet: [testnet-guide.md](testnet-guide.md), or press **Testnet** on the bridge page.

## Network

| | |
|---|---|
| Network name | ANT CHAIN |
| Chain ID | `26800` (`0x68b0`) |
| RPC | `https://rpc.antchain.tech` |
| Currency | ANT, 18 decimals |
| Explorer | [antchain.tech/explorer](https://antchain.tech/explorer/) |
| Parent chain | Robinhood Chain, chain ID `4663` |
| ANT on Robinhood Chain | `0xbbB6c29bCc3a1028A2B54310DF73F4F7A3bcB373` |

Every contract address is in [contracts.md](contracts.md).

## What you need

- **ANT on Robinhood Chain.** This is what you bridge in, and it becomes your gas.
- **A little ETH on Robinhood Chain** for the approve and deposit transactions there.

## 1. Bridge ANT in

1. Open [antchain.tech/bridge](https://antchain.tech/bridge/) and press **Connect wallet**. MetaMask, Rabby, Coinbase Wallet and mobile wallets (through WalletConnect) work. Check that the switch at the top says **Mainnet**.
2. Under **Deposit**, enter an amount of ANT.
3. Confirm two transactions on Robinhood Chain: *Approve* (only the first time), then *Deposit*.
4. The ANT arrives on ANT CHAIN as gas, usually within a minute.
5. Press **Add network** to see ANT CHAIN and your ANT in your wallet.

## 2. Use it

- **Send and deploy** like on any EVM chain. Fees are paid in ANT and are a fraction of a cent for a transfer.
- **Trade** on the [exchange](https://antchain.tech/swap/) (Uniswap V2 contracts). Mainnet pools are created by their liquidity providers; if a pair has no pool yet, the page says so.
- **Look anything up** in the [explorer](https://antchain.tech/explorer/).

## Bridging $ANTC

The **Bridge $ANTC** card on the bridge page moves $ANTC between Robinhood Chain and ANT CHAIN (for example to use the [launchpad](launchpad.md)). Going in takes about a minute and needs about 0.0004 ANT on Robinhood Chain for the ticket (unused part refunded). Going back takes about 7 days and is claimed from **Your withdrawals**, like ANT.

## 3. Withdraw ANT back to Robinhood Chain

Withdrawing has two steps, and the second one comes about **7 days** later.

1. On the bridge page, open **Withdraw**, enter an amount and confirm one transaction on ANT CHAIN.
2. The withdrawal appears under **Your withdrawals** with a countdown. It waits for the challenge window: the validator's claim about the chain's state has to stand for about 7 days, the same rule Arbitrum One uses. This is what keeps the bridge safe.
3. When the countdown ends, press **Claim** and confirm one transaction on Robinhood Chain. Your ANT is back.

Nobody can speed up a withdrawal or cancel it once it has started. The claim stays available, so you can claim later as well.

## Fees

| | |
|---|---|
| Transfer on ANT CHAIN | A fraction of a cent, paid in ANT |
| Deposit / claim | Normal Robinhood Chain gas, paid in ETH |
| Bridge fee | None |

The fee pricer converts the chain's ETH costs into ANT using Chainlink's ETH/USD feed and the ANT market price from the USDG/ANT pool on Robinhood Chain, kept current by the price keeper.

## Know the risks

- **One operator** runs the sequencer, the batch poster and the validator today. The validator posts a bond and its claims can be challenged during the window.
- **ANT is issued by Robinhood.** If the issuer pauses ANT, deposits and withdrawals of ANT pause too.
- **The contracts have not had an external audit yet.** Start with amounts you are comfortable with.
- ANT CHAIN is independent and is not affiliated with Anthropic, PBC, Robinhood Markets, Inc. or Offchain Labs. Nothing here is an offer or investment advice.

## Common problems

| Problem | Fix |
|---|---|
| "Insufficient funds" on Robinhood Chain | You need a little ETH there for the approve and deposit, not only ANT. |
| Deposit sent but no ANT on ANT CHAIN | Wait a minute and refresh. Check that your wallet is on ANT CHAIN (26800), not testnet (26801). |
| The bridge shows tANT | The switch is on Testnet. Press **Mainnet** at the top of the page. |
| The Claim button is not there | The 7 day window has not ended yet; the countdown shows when it does. |
