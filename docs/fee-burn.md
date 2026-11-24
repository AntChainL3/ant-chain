# When the swap fee is burned

0.05% of every swap on the ANT CHAIN exchange, taken from the 0.3% pool fee, is turned into $ANTC and sent to the dead address `0x000000000000000000000000000000000000dEaD`. Traders pay nothing extra (0.25% still goes to liquidity providers) and the bridge has no fee. Live since 24 November 2026.

A burn does not happen on every swap. It happens in three steps.

1. **Swaps: the fee builds up inside the pool.** Each swap pays 0.3%. The 0.05% part stays in the pool for now; this is how Uniswap V2 keeps swaps cheap.
2. **A liquidity event: the fee is handed to the FeeBurner.** When anyone adds or removes liquidity in that pool, the pool works out the fee earned since the last such event and mints it to the FeeBurner as pool shares (Uniswap V2 `_mintFee`). Adding or removing liquidity, a launchpad token graduating, and the keeper's own unwinding all count. The first event in a pool after the fee was switched on only sets the starting point (`kLast`).
3. **The keeper runs (every 6 hours): the burn.** It unwinds the FeeBurner's pool shares into their two tokens, swaps everything that is not $ANTC to $ANTC with the output sent straight to `0x…dEaD`, and sends any $ANTC the FeeBurner holds to `0x…dEaD`. A step waits for a later run until it is worth at least three times its gas, and each swap is sized so it moves the price by at most 3%. Code: [fee-burner-job.js](../chain/scripts/fee-burner-job.js).

## Example

| Time | What happens | Burn status |
|---|---|---|
| Monday 10:00 | People swap $1,000 in total on the ANT / $ANTC pool | 0.05% = $0.50 builds up in the pool |
| Monday 14:00 | Someone adds liquidity to that pool | The $0.50 now belongs to the FeeBurner |
| Monday 17:45 | The keeper runs | Swapped to $ANTC and sent to `0x…dEaD` |

## Check it yourself

| | |
|---|---|
| FeeBurner | `0x110797efDcBedD157920Faee8e020E51270348Fc` ([source](../chain/contracts/FeeBurner.sol), bytecode checked in CI) |
| Total burned | `totalBurned()` on the FeeBurner |
| Each burn | a $ANTC transfer to `0x…dEaD`, with a `SwappedAndBurned` or `Burned` event |
| Fee switch | `feeTo()` on the exchange factory `0xF7ba8FDa62e031252151D3c5b6F05C1dbA05459A` returns the FeeBurner |

## What can and cannot change

- The FeeBurner can only burn. Nothing can be taken out of it: $ANTC can only go to `0x…dEaD`, and other tokens can only be swapped to $ANTC sent to `0x…dEaD`.
- Its operator (the keeper, `0x82218fb2cE98cEA1ec852892770f986ca53e1970`) can only choose when and along which route to swap. The owner (the deployer) can only change the operator.
- The deployer is the exchange factory's `feeToSetter`: it can point the fee elsewhere or turn it off. It cannot change the 0.3% fee or touch liquidity in any pool.
