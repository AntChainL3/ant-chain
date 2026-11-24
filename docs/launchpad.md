# Launchpad

The ANT CHAIN launchpad lets anyone create a token in one transaction. Every trade on it is paid in **$ANTC**.

Page: [antchain.tech/launch](https://antchain.tech/launch/) · Contract: [`chain/contracts/AntcLaunchpad.sol`](../chain/contracts/AntcLaunchpad.sol)

| | Status |
|---|---|
| Testnet (tANTC stands in for $ANTC, free from the page's faucet) | **Live** at `0x9b8Ac46DCDe0EA76DaF48a3f370C6DA8A04586a8` |
| Mainnet (trades in $ANTC bridged to ANT CHAIN) | **Live** at `0x2BECe5405eE63844e6d14dF44c3aDE22AD3533dA` (new tokens graduate at 10,000,000 $ANTC raised; $SHOGGOTH, the first token, graduated at 1,000,000) |

## How a token works

1. **Create.** Pick a name, a ticker, a description and an image link. You can buy some in the same transaction.
2. **Supply.** Every token has exactly 1,000,000,000. The token contract has no owner, no mint, no fees and no blacklist.
3. **Bonding curve.** 800,000,000 tokens are sold on a curve priced in $ANTC. Each buy raises the price, each sell lowers it. You can sell back to the curve at any time.
4. **Graduation.** When all 800,000,000 are sold, the remaining 200,000,000 and all $ANTC the curve raised go into a Uniswap V2 pool on the [ANT CHAIN exchange](https://antchain.tech/swap/). The pool shares are sent to a dead address, so that liquidity can never be withdrawn. The curve's last price equals the pool's first price.
5. **After graduation** the token trades on the exchange like any other token.

Until a token graduates, nobody but the launchpad can send it to its pool. That stops anyone from seeding the pool at a wrong price first.

## Fees

| | |
|---|---|
| Trading fee | 1% of each buy and sell, in $ANTC. Half is burned (sent to `0x…dEaD`), half goes to the treasury. |
| Creating a token | Free on testnet. |
| Exchange fee after graduation | 0.3% per swap (standard Uniswap V2): 0.25% to liquidity providers, 0.05% buys $ANTC back and burns it. |

The owner can change the fee (never above 2%), the fee split, the creation fee and the graduation target **for new tokens**, and can pause the creation of new tokens. The owner can never move the $ANTC or tokens held for a curve, and can never stop anyone from selling back to a curve.

## Using $ANTC on ANT CHAIN

$ANTC lives on Robinhood Chain. To trade on the launchpad, bridge it into ANT CHAIN with the **Bridge $ANTC** card on [antchain.tech/bridge](https://antchain.tech/bridge/). It goes through the standard token gateway and appears at `0x65024Ab548EecDcCb686a3DcaC4DE2BF9b63042c` on ANT CHAIN, usually within a minute. Bridging in also needs a little ANT on Robinhood Chain for the ticket (about 0.0004 ANT, the unused part is refunded). Bridging back to Robinhood Chain takes about 7 days, like every withdrawal from ANT CHAIN, and is claimed from "Your withdrawals" on the bridge page.

## Risks

Anyone can create a token, including copies of real projects and tokens made to lose you money. ANT CHAIN does not review or endorse them. Check the creator and the contract address, and only spend what you can lose. The contracts are covered by 22 tests including fuzzing, and have not had an external audit yet. Nothing here is investment advice.
