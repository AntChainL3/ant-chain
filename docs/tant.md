# tANT: the testnet gas token

**tANT** ("Test ANT") is the gas token of **ANT CHAIN Testnet**. It plays the part that the real ANT Stock Token plays on mainnet, so you can try every feature of ANT CHAIN without spending anything.

> tANT has **no value**. It cannot be bought, sold or exchanged for real ANT, and it never will be. Never send real assets to testnet addresses.

## At a glance

| | |
|---|---|
| Name / symbol | Test ANT / `tANT` |
| Standard | ERC-20, 18 decimals, no transfer fees, no rebasing |
| Lives on | Robinhood Chain Testnet (chain ID 46630) |
| Address | `0xbf10d827020a5f4260e27a005ae0034d97514b17` |
| On ANT CHAIN Testnet | the **native currency**: your wallet balance and every fee |
| Source | [`chain/contracts/TestANT.sol`](../chain/contracts/TestANT.sol) |
| Value | none |

## Why a test token?

ANT CHAIN mainnet uses the real ANT Stock Token as gas. To let anyone try the chain freely, the testnet runs the same software with a stand-in token that behaves the same way:

- you hold it on the parent chain (Robinhood Chain Testnet),
- you **bridge** it into ANT CHAIN, where it becomes the native gas currency,
- every fee, swap and contract call on ANT CHAIN Testnet is paid in it,
- you can **withdraw** it back to the parent chain, with the same challenge-window wait that mainnet has (shorter on testnet).

## How to get tANT

**Option 1: the test kit (easiest).** Open the [bridge page](https://antchain.tech/bridge/), connect your wallet and press **Get test kit**. Our faucet sends, on Robinhood Chain Testnet:

- a small amount of **testnet ETH** (only if your wallet is short), to pay for the deposit transaction there, and
- **100 tANT**.

One kit per wallet (and per network connection) every 24 hours. You do not need any other faucet.

**Option 2: the contract's own faucet.** If you already have testnet ETH on Robinhood Chain Testnet, call `drip()` on the tANT contract (the bridge page has a button for it). It mints **100 tANT** to the caller, once a day per address.

```bash
cast send 0xbf10d827020a5f4260e27a005ae0034d97514b17 "drip()" \
  --rpc-url https://rpc.testnet.chain.robinhood.com --private-key $TEST_KEY
```

## Using tANT

1. **Deposit** tANT through the bridge. The same amount appears on ANT CHAIN Testnet as gas, usually within a minute.
2. **Spend** it: transfers, swaps on the exchange, contract deployments. A simple transfer costs about 0.0000028 tANT.
3. **Withdraw** it back to Robinhood Chain Testnet. Claims open after about an hour; the bridge page shows a countdown and a **Claim** button.

On ANT CHAIN Testnet there is also **Wrapped tANT** (`0xCaab57bf6F4AC057E2024C5778000fb377372548`), an ERC-20 version of the native tANT used by the exchange, the same way WETH wraps ETH.

## tUSD

**tUSD** ("Test USD") is a second test token, used to give the exchange a trading pair. It lives on ANT CHAIN Testnet at `0xA020932FB3D16836B0B8741370a5D4B123eEc43c`, has 18 decimals, and anyone can call `drip()` for 10,000 tUSD a day. It is not pegged to anything and has no value.

## What the contract can do

`TestANT.sol` is a plain OpenZeppelin ERC-20 with two extras:

- `drip()`: public, 100 tANT per address per 24 hours.
- `mint(to, amount)`: **owner only**, used to fund the faucet and seed tests.

There are no transfer hooks, fees, pauses or blocklists. The real ANT token on mainnet does have issuer controls (pause, block, burn, upgrade); see [how-it-works.md](how-it-works.md#the-gas-token-on-mainnet).

## FAQ

**Is tANT the same as $ANTc?** No. tANT is a test stand-in for ANT, the gas token. $ANTc is the planned ANT CHAIN token, which has not launched.

**Will tANT be converted or airdropped into anything?** No. Testnet balances carry no rights and are not converted into anything.

**The dollar amounts on testnet: are they real?** They use the live ANT price from our fee pricer to show what the same fee *would* cost on mainnet. Your tANT itself is worth nothing.
