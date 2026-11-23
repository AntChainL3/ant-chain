# Transparency

Everything ANT CHAIN runs is listed here: every contract and the source it was built from, every wallet the team operates and what it can do, where fees go, and what is not in place yet. All of it can be checked on chain.

As of 24 November 2026.

## Check it yourself

Every ANT CHAIN contract on chain is exactly the code in this repository. You can prove it in one command, with no keys:

```bash
cd chain && npm ci && forge build && node scripts/verify-bytecode.js
```

It compiles the sources here and compares them byte for byte with the code deployed on Robinhood Chain and on ANT CHAIN. Only constructor-set values may differ. The same check runs in [CI](.github/workflows/ci.yml) on every push.

```text
MATCH  ANTcStaking ($ANTC staking for gas credits)   Robinhood Chain 0xfd0d05df472a932e6bc64ca34744c77fd3c7b1ac
MATCH  AntFeeTokenPricer (ANT fee pricer)            Robinhood Chain 0x87b35eb0ed8724250126fd16ba3c1f3509eeb2ab
MATCH  AntcLaunchpad (launchpad)                     ANT CHAIN 0x2BECe5405eE63844e6d14dF44c3aDE22AD3533dA
MATCH  WrappedANT (WANT)                             ANT CHAIN 0xf4dc96b75d44EE74a6a4Ea59004aa9f8AF4C1Bb4
MATCH  UniswapV2Factory (exchange)                   ANT CHAIN 0xF7ba8FDa62e031252151D3c5b6F05C1dbA05459A
MATCH  UniswapV2Router02 (exchange)                  ANT CHAIN 0x3Cd343c668cCBaEaE01326ffc721C840A1A1BefF
All 6 contracts match the source in this repository.
```

The chain's own core contracts (rollup, bridge, inbox, outbox, token bridge) are the standard Arbitrum Nitro contracts deployed by Offchain Labs' [orbit SDK](https://github.com/OffchainLabs/arbitrum-chain-sdk), not code written here.

## Contracts we wrote

| Contract | Chain | Address | Source | Tests |
|---|---|---|---|---|
| ANTcStaking | Robinhood Chain | `0xfd0d05df472a932e6bc64ca34744c77fd3c7b1ac` | [ANTcStaking.sol](chain/contracts/ANTcStaking.sol) | 23 incl. fuzz |
| AntFeeTokenPricer | Robinhood Chain | `0x87b35eb0ed8724250126fd16ba3c1f3509eeb2ab` | [AntFeeTokenPricer.sol](chain/contracts/AntFeeTokenPricer.sol) | 11 |
| AntcLaunchpad | ANT CHAIN | `0x2BECe5405eE63844e6d14dF44c3aDE22AD3533dA` | [AntcLaunchpad.sol](chain/contracts/AntcLaunchpad.sol) | 22 incl. fuzz |
| LaunchToken (one per launched token) | ANT CHAIN | created by the launchpad | [LaunchToken.sol](chain/contracts/LaunchToken.sol) | in the launchpad suite |
| WrappedANT | ANT CHAIN | `0xf4dc96b75d44EE74a6a4Ea59004aa9f8AF4C1Bb4` | [WrappedANT.sol](chain/contracts/WrappedANT.sol) | — |

Every other address is in [docs/contracts.md](docs/contracts.md).

## Tokens

| Token | Address | Notes |
|---|---|---|
| ANT (gas) | `0xbbB6c29bCc3a1028A2B54310DF73F4F7A3bcB373` on Robinhood Chain | Issued by Robinhood Assets (Jersey) Limited. Not ours; its issuer can pause, block, burn and upgrade it. |
| $ANTC | `0x1A9ca5A347c4aeAb4870668E76506E45C23D6281` on Robinhood Chain | Our token. 1,000,000,000 fixed supply, no owner, launched on Pons. Not a share of any company. |
| $ANTC on ANT CHAIN | `0x65024Ab548EecDcCb686a3DcaC4DE2BF9b63042c` | Created by the standard Arbitrum token gateway; backed 1:1 by $ANTC locked in the gateway on Robinhood Chain. |

## Wallets the team operates

All are single-key wallets (EOAs) held by the operator. There is no multisig.

| Role | Address | What it does | What it can change |
|---|---|---|---|
| Deployer / owner | `0x032c47Ff69165F2723BE277A8049Dc9308c8f838` | Deployed the contracts; owns them | See "What the owner can do" |
| Batch poster | `0xA7eD0281fe56209D094315527C4AfFc8Bf8346aB` | Posts ANT CHAIN's transaction batches to Robinhood Chain | Nothing else |
| Validator | `0x98136b570891de44dAfeC819491b7a5A546faC1E` | Posts a bond and asserts the chain's state | Its claims can be challenged by anyone |
| Price keeper | `0x82218fb2cE98cEA1ec852892770f986ca53e1970` | Keeps the fee pricer's ANT price in line with the market ([keeper.js](chain/scripts/keeper.js)) | At most ±10% per update, at most once a minute |
| Gas-credits redeemer | `0x7f76693f374Aa9049dDFca473Bf23181E7Ea1DAe` | Records credit use and sends gas to stakers ([credits.js](chain/scripts/credits.js)) | Only `spendCredits`, never staked tokens |

## What the owner can do

| Contract | The owner can | The owner can never |
|---|---|---|
| ANT CHAIN (rollup, via the upgrade executor `0x24a4848777bdf4485A4D335407758EcBC7F6F9d1`) | Upgrade the chain's core contracts (bridge, inbox, outbox, rollup) and change their settings. An upgrade can change any rule, including withdrawals, and there is no timelock: this is the main trust assumption today | — |
| ANT CHAIN (chain owner, ArbOS) | Change gas pricing parameters | — |
| ANTcStaking | Choose the redeemer; pause **new** stakes; recover tokens sent to it by mistake | Move staked $ANTC, block unstaking, take earned credits |
| AntFeeTokenPricer | Set the ANT or ETH price directly (for emergencies and corporate actions); change the keeper and its limits | Set a price outside $0–$1,000,000 |
| AntcLaunchpad | Change the fee (never above 2%), fee split, creation fee and graduation target for **new** tokens; pause **new** launches | Move $ANTC or tokens held for a curve; stop anyone selling back to a curve; touch graduated liquidity |
| LaunchToken | No owner | — |
| $ANTC | No owner | — |

## Where the money goes

| Flow | Destination |
|---|---|
| ANT CHAIN gas fees | Network fee account `0x032c47Ff69165F2723BE277A8049Dc9308c8f838` (the deployer); this pays for posting batches to Robinhood Chain |
| Launchpad trading fee (1% of each trade, in $ANTC) | Half burned (sent to `0x000000000000000000000000000000000000dEaD`), half to the treasury `0x032c47Ff69165F2723BE277A8049Dc9308c8f838` |
| Launchpad graduation | All $ANTC raised + 200,000,000 tokens go into a Uniswap V2 pool; the pool shares go to `0x…dEaD`, so that liquidity can never be withdrawn |
| Exchange swaps | 0.3% to liquidity providers (standard Uniswap V2); the protocol fee switch is off |
| Bridge | No fee. Deposits are locked in the bridge contract on Robinhood Chain until withdrawn |
| Gas-credit claims | Paid from the redeemer's ANT on ANT CHAIN; the credits used are recorded on chain (`CreditsSpent` events) |

## Not in place yet

- **No external audit.** The contracts are covered by automated tests (unit and fuzz) and static analysis ([SonarCloud](https://sonarcloud.io/summary/overall?id=AntChainL3_ant-chain&branch=main)), which are not an audit.
- **No multisig or timelock.** One key controls upgrades and settings.
- **One operator** runs the sequencer, batch poster and validator.
- **Off-chain services** (price keeper, gas-credits service) run on Railway with their keys there; their code is in [chain/scripts](chain/scripts).

## How to report a problem

See [SECURITY.md](SECURITY.md).
