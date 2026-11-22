# ANT CHAIN

Arbitrum Nitro L3 (Rollup mode, BoLD) settling to Robinhood Chain, with the **ANT Stock Token** as the gas token.

| | Mainnet | Fork rehearsal | Testnet |
|---|---|---|---|
| Chain ID | 26800 | 26800 | 26801 |
| Parent | Robinhood Chain (4663) | local Anvil fork of 4663 | Robinhood Chain Testnet (46630) |
| Gas token | ANT `0xbbB6c29bCc3a1028A2B54310DF73F4F7A3bcB373` | real ANT on the fork | tANT |
| Keys | `../.env.mainnet` | `../.env.mainnet` (no real funds spent) | `../.env` |

## Contracts

- `contracts/AntFeeTokenPricer.sol`: tells the SequencerInbox how many raw ANT equal 1 ETH (ETH/USD from Chainlink `0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9`, ANT/USD from the keeper). `getExchangeRate()` never reverts; 11 tests including 10,000 fuzz runs (`forge test`).
- `contracts/TestANT.sol`: testnet-only gas token.
- `contracts/dev/*Mock.sol`: Arbitrum precompile stand-ins, used **only** on the local fork.

## Mainnet flow

```bash
npm run rehearse              # full deployment on a mainnet fork + 19 checks; unlocks mainnet
npm run mainnet:check         # balances of operator wallets
INITIAL_ANT_USD=97.17 npm run mainnet:rollup   # pricer + core contracts; asks you to type "deploy mainnet"
npm run mainnet:node-config   # nodeConfig.mainnet.json for the Nitro node
```

Mainnet scripts refuse to run until `npm run rehearse` has passed (`rehearsal.json`).

## Testnet flow

```bash
node scripts/01-deploy-tant.js          # tANT on Robinhood Chain Testnet
node scripts/01b-deploy-mock-feed.js    # mock ETH/USD feed (testnet has no Chainlink feed)
node scripts/02-create-rollup.js        # pricer + core contracts
node scripts/03-node-config.js          # nodeConfig.testnet.json
node scripts/05-dex.js                  # Wrapped tANT, Uniswap V2, tUSD, seeded pool
node scripts/testnet-smoke.js           # drip, deposit, swap, withdraw
node scripts/testnet-claim.js           # claim withdrawals once confirmed
node scripts/faucet.js                  # "Get test kit" service (testnet ETH + 100 tANT)
```

## Status

| | Testnet | Mainnet |
|---|---|---|
| Rollup + Nitro node (sequencer, batch poster, BoLD validator) | running on Railway | running quietly on Railway, not announced (site stays on testnet) |
| Token bridge (gateway router) | not needed for the demo | deployed |
| Keeper (ANT/USD to the pricer) | deployer key | ready, not restarted yet |
| Exchange (Uniswap V2 + Wrapped ANT) | deployed, tANT/tUSD pool seeded | deployed 22 Nov 2026, no pools yet |
| Faucet | running on Railway | n/a |

Still open before mainnet users: move chain ownership to a Safe multisig, monitoring and alerts (batch poster ETH, validator stake, keeper freshness, ANT `paused()`, registry `isBlocked(bridge)`).

User-facing documentation lives in [`../docs`](../docs).

## Keys

Never commit or share `.env`, `.env.mainnet`, or `nodeConfig.*.json` (all gitignored). Before launch, move operator keys into Railway variables and the chain owner role to a Safe.

## DNS note

Some ISPs hijack DNS for `*.robinhood.com`, even plain UDP to 1.1.1.1. `scripts/lib.js` resolves through Cloudflare DNS-over-HTTPS and still verifies TLS certificates.
