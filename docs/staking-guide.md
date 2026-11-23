# Staking $ANTC for gas credits

Stake $ANTC on Robinhood Chain and earn gas credits every second. Credits will pay for your transactions on ANT CHAIN once credit spending opens (coming soon). You can unstake at any time.

Page: [antchain.tech/stake](https://antchain.tech/stake/)

## What you need

| | |
|---|---|
| Network | Robinhood Chain, chain ID `4663` |
| RPC (if your wallet asks) | `https://robinhood.drpc.org` |
| $ANTC | `0x1A9ca5A347c4aeAb4870668E76506E45C23D6281` (get it on [Pons](https://ponsfamily.com/launchpad/0x1A9ca5A347c4aeAb4870668E76506E45C23D6281)) |
| Staking contract | `0xfd0d05df472a932e6bc64ca34744c77fd3c7b1ac` |
| Gas | A little ETH on Robinhood Chain for the approve and stake transactions |

Only the two addresses above are ours. Other tokens with the name "ANT Chain" are not $ANTC.

## Stake

1. **Open** [antchain.tech/stake](https://antchain.tech/stake/) and press **Connect wallet**. MetaMask, Rabby, Coinbase Wallet and mobile wallets (through WalletConnect) work.
2. **Switch network.** If your wallet is on another chain, the page asks it to switch to Robinhood Chain, and adds the network if the wallet does not know it yet. Approve that in your wallet.
3. **Enter an amount**, or press **Max** to stake everything in your wallet.
4. **Approve, then stake.** The first time, your wallet asks for two transactions: *Approve* lets the staking contract take $ANTC from you, then *Stake* moves it in. Later stakes need only the second one.
5. **Watch credits grow.** The page shows your staked amount and your credits, counting up every second.

## How credits are counted

Credits are **token-days**: 1 $ANTC staked for 1 day earns 1 credit. 100 $ANTC staked for 3 days earns 300. Adding or removing $ANTC changes the rate from that moment; credits already earned stay.

## Use credits: claim gas

On the Stake page, the **Claim gas on ANT CHAIN** card turns credits into gas:

1. Press **Claim gas**. Your wallet asks you to **sign a message**. It is free and is not a transaction; it only proves the wallet is yours, so nobody can spend your credits.
2. The credits service checks your credits on chain, records the use with `spendCredits` on the staking contract, and sends ANT to the same address on ANT CHAIN.
3. One claim per wallet per day, and a daily limit for everyone together. The card shows how many credits a claim costs and how much gas it gives.

Every use is recorded on chain (`spentOf` and the `CreditsSpent` event), so anyone can check it. The service's code is [`chain/scripts/credits.js`](../chain/scripts/credits.js).

## Unstake

Switch to the **Unstake** tab, enter an amount (or **Max**) and confirm one transaction. The $ANTC returns to your wallet right away.

- No lock and no fee: you can unstake at any time.
- Credits you have earned are kept after you unstake.
- Nobody, including the ANT CHAIN team, can move staked tokens or block an unstake.

## What the owner can and cannot do

The contract owner can only:
- pause **new** stakes (unstaking always works);
- choose the *redeemer*, the account that records credit use when gas is paid;
- recover tokens sent to the contract by mistake, but never the $ANTC that people staked.

The source is [`chain/contracts/ANTcStaking.sol`](../chain/contracts/ANTcStaking.sol), covered by 23 tests including fuzzing.

## What credits are not

Credits are not a token. They cannot be transferred, sold or traded, and they pay no yield or reward. They are only a right to use gas on ANT CHAIN. Nothing here is an offer or a promise of value. $ANTC has no connection to Anthropic, PBC.

## Common problems

| Problem | Fix |
|---|---|
| "Insufficient funds" | You need a little ETH on Robinhood Chain for gas, not just $ANTC. |
| The button keeps asking to switch network | Add Robinhood Chain manually: chain ID `4663`, RPC `https://robinhood.drpc.org`, currency ETH. |
| My $ANTC balance shows 0 | Check that you hold the real $ANTC (`0x1A9c…6281`) and that the wallet is on Robinhood Chain. |
| Credits are not counting | Credits only grow while something is staked. Refresh the page after the stake transaction confirms. |
