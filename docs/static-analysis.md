# Static analysis

Every push runs [Slither](https://github.com/crytic/slither) 0.11.6 on `chain/contracts` in [CI](../.github/workflows/ci.yml). The job fails on any High finding, and all findings are published in the repository's **Security → Code scanning** tab.

Latest run, as of 24 November 2026: **0 High**, 7 Medium, 16 Low, 7 Informational. Each finding was reviewed. None is an exploitable issue in the deployed contracts; the reasoning is below so reviewers do not have to repeat it.

Run it yourself:

```bash
cd chain && npm ci && forge build
pipx install slither-analyzer==0.11.6
slither . --config-file slither.config.json
```

## Triage

| Finding | Where | Verdict |
|---|---|---|
| `divide-before-multiply` (4) | `AntcLaunchpad`: `buy`, `sell`, `quoteBuy`, `quoteSell` | **By design.** The curve output is computed first, then the fee is taken as a percentage of it. The rounding loss is at most 1 wei per trade and always rounds in the launchpad's favour (outputs round down, the sell-out cost rounds up). Covered by the fuzz tests `testFuzz_solvency` and `testFuzz_noFreeProfit`. |
| `incorrect-equality` (2) | `ANTcStaking.stake` (`received == 0`), `ANTcStaking.recover` (`amount == 0`) | **False positive.** These reject zero amounts; they are not balance invariants an attacker can break by donating tokens. |
| `reentrancy-no-eth` (1), `reentrancy-benign` (1) | `AntcLaunchpad.create` / `_newToken` | **False positive.** The external calls go to the exchange's Uniswap V2 factory (fixed at deployment) and to the `LaunchToken` the launchpad just deployed; neither calls back. All state-changing entry points are `nonReentrant`. |
| `missing-zero-check` (4) | `ANTcStaking.setRedeemer`, `AntFeeTokenPricer.setKeeper` and constructor, `LaunchToken.setPair` | **Intended.** Setting the redeemer or keeper to `address(0)` is how they are switched off. `setPair` can only be called once, by the launchpad, with the pair the factory returned. |
| `return-bomb` (1), `low-level-calls` (1) | `AntFeeTokenPricer._refreshEth` | **Low.** A gas-capped `staticcall` to the Chainlink ETH/USD feed, whose address is immutable. The cap is there so a broken feed cannot make fee pricing revert; the pricer then keeps its last good price. |
| `low-level-calls` (1) | `WrappedANT.withdraw` | **Standard WETH pattern.** The balance is reduced before the native-ANT transfer, and a failed transfer reverts. |
| `timestamp` (10) | deadlines in `AntcLaunchpad`, credit accrual in `ANTcStaking`, freshness checks in `AntFeeTokenPricer`, test-token faucets | **By design.** Time windows are minutes to days; a sequencer can shift `block.timestamp` by seconds at most, which changes nothing meaningful. |
| `naming-convention`, `unindexed-event-address` | various | Style only. |

## What is not covered here

Static analysis finds patterns, not logic errors. The contracts also have unit and fuzz tests (`chain/test`, 56 tests), and their deployed bytecode is checked against this source on every push (see [TRANSPARENCY.md](../TRANSPARENCY.md)). They have not had an external audit yet.

## Changes made after the scan

Only code that is not deployed on mainnet was changed: the testnet mock feed now implements the Chainlink interface and keeps its owner immutable, and test, mock and testnet-token files pin `pragma solidity 0.8.28`. The mainnet contracts are unchanged, so their verified source (Sourcify, bytecode check) still matches.
