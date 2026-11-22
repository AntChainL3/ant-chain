# How ANT CHAIN works

ANT CHAIN is an [Arbitrum Orbit](https://docs.arbitrum.io/launch-orbit-chain/orbit-gentle-introduction) chain: the same Nitro software as Arbitrum One, run as a **Rollup** (not AnyTrust) with **BoLD** dispute resolution, using a **custom gas token**.

```text
           Ethereum            final settlement
              ▲
       Robinhood Chain         Layer 2 (chain 4663, testnet 46630): stores ANT CHAIN's data
              ▲
         ANT CHAIN             Layer 3 (chain 26800, testnet 26801): where you transact
```

## The life of a transaction

1. **Sign.** Your wallet sends a transaction to the ANT CHAIN RPC. Gas is priced and paid in ANT (tANT on testnet). Balances and `msg.value` are in ANT too.
2. **Order.** The sequencer puts it in a block and returns a receipt, usually within a second. Our first mainnet transfer was confirmed in 2.7 seconds end to end.
3. **Batch.** The batch poster compresses many blocks into one batch and posts it to the SequencerInbox on Robinhood Chain. That is where the chain's data lives; anyone can rebuild ANT CHAIN's state from it.
4. **Vouch.** A bonded validator posts an assertion: a claim about the resulting state. During the challenge window anyone can dispute a wrong claim with a fraud proof (BoLD).
5. **Settle.** Robinhood Chain settles to Ethereum, so ANT CHAIN shares the root of trust of every Arbitrum chain.

## Paying for the parent chain in ANT

Posting batches costs ETH on Robinhood Chain, but users pay fees in ANT. The **fee token pricer** bridges the two: it tells the chain how many ANT equal one ETH, so the batch poster is repaid fairly in ANT.

- Contract: [`chain/contracts/AntFeeTokenPricer.sol`](../chain/contracts/AntFeeTokenPricer.sol)
- ETH/USD comes from Chainlink on Robinhood Chain; ANT/USD is pushed by our keeper ([`chain/scripts/keeper.js`](../chain/scripts/keeper.js)).
- `getExchangeRate()` never reverts; it falls back safely if a price is stale. Covered by 11 Foundry tests including 10,000 fuzz runs.
- On testnet, a mock ETH/USD feed stands in for Chainlink.

## Bridging

**Deposits** call `depositERC20(amount)` on the chain's Inbox on the parent chain. The gas token is locked in the Bridge contract there and the same amount is minted as native currency on ANT CHAIN, usually within a minute.

**Withdrawals** call `withdrawEth(destination)` on the ArbSys precompile on ANT CHAIN with the amount as value (the name is historical; it withdraws the native gas token). That burns the ANT on ANT CHAIN and creates a message. Once an assertion that includes the message is confirmed, anyone can execute it on the Outbox on the parent chain, which releases the tokens from the Bridge.

| | Challenge window | Typical total wait |
|---|---|---|
| Testnet | 150 parent blocks | 45 to 60 minutes |
| Mainnet | 50,400 parent blocks | about 7 days |

The wait is the security model, not a delay we can shorten.

Other ERC-20 tokens travel through the standard Arbitrum token bridge (gateway router) on mainnet.

## The exchange

The ANT CHAIN exchange uses the **Uniswap V2** factory and router, deployed unmodified from Uniswap's published bytecode, plus **Wrapped ANT** (a WETH9-style wrapper) so the native gas token can trade like an ERC-20. 0.3% of each trade goes to liquidity providers. Anyone can create a pool, including for fake tokens, so check addresses before you trade.

## The gas token on mainnet

ANT is the Robinhood Stock Token for Anthropic, PBC Class A Common Stock (`0xbbB6c29bCc3a1028A2B54310DF73F4F7A3bcB373` on Robinhood Chain). ANT CHAIN does not issue it and cannot change it.

- **What it is:** a tokenized debt security issued by Robinhood Assets (Jersey) Limited that tracks the share price. Holders get price exposure, not shares or shareholder rights.
- **Who can hold it:** not US persons, and restricted in Canada, the UK, Switzerland, the UAE and sanctioned places. The issuer's terms decide.
- **What its issuer can do:** pause all transfers, block any address (including our bridge), burn from any address, upgrade the token contract, and adjust a multiplier after dividends or splits (balances stay the same; our fee price follows the market).

These controls apply to every chain that uses a Robinhood stock token as gas. If transfers are paused or the bridge is blocked, deposits and withdrawals stop until that changes; activity inside ANT CHAIN can continue with ANT already bridged.

## Who runs what

| Role | Today |
|---|---|
| Sequencer, batch poster, validator | one operator (us) |
| Chain owner (upgrades, settings) | deployer key |
| Keeper (ANT/USD price) | one operator (us) |
| Infrastructure | Railway (nodes, website, faucet) |

This is normal for a new Arbitrum chain, and it is the main trust assumption to know about. The sequencer can delay or reorder transactions but cannot forge state, because the validator's claims are bonded and can be challenged, and withdrawals wait for the challenge window.
