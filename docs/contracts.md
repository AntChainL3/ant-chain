# Contract addresses

Always check addresses against this page or [antchain.tech](https://antchain.tech/#network) before you interact. Anyone can deploy look-alike tokens.

## Testnet

### On Robinhood Chain Testnet (46630)

| Contract | Address |
|---|---|
| tANT (test gas token) | `0xbf10d827020a5f4260e27a005ae0034d97514b17` |
| Inbox (deposits) | `0xc49C0f0faFAB36A5Fe5c2098dEDf958afe3e0730` |
| Bridge (escrow) | `0x8d3A8e6E0938009ba6d46E9904E7B367Ef290682` |
| Outbox (claims) | `0x2098519c82D56df147e3EE73886B840026431259` |
| Rollup | `0xe5336CD5C0A0a9f26967FB4C2F14a8F1109Cd62D` |
| Sequencer inbox | `0x6908E358ff65aed84c44C3Df699262f5B6CBD151` |
| Challenge manager | `0x66A04fce24303BAE871CAdfCAaCd90A89A751B7E` |
| Fee token pricer | `0x545328faa9c28fda8d9c1d23ad4bd32f52b2daa7` |
| Mock ETH/USD feed (testnet only) | `0x9e541d48480d3fdbdcb5ce534ab6f5974e137a66` |
| $ANTC staking, test mode (tANT stands in for $ANTC) | `0xf3ab16504dcb85390924662f780f49d91387b857` |

### On ANT CHAIN Testnet (26801)

| Contract | Address |
|---|---|
| Exchange router (Uniswap V2 Router02) | `0x2Db8b8200a474F47640f16dB66C0089169b6FDaa` |
| Exchange factory (Uniswap V2) | `0xc90CdDc8B6bC5c1724e10Ccb161d89e12f162Af2` |
| Wrapped tANT | `0xCaab57bf6F4AC057E2024C5778000fb377372548` |
| tUSD (test token) | `0xA020932FB3D16836B0B8741370a5D4B123eEc43c` |
| tANT / tUSD pool | `0x98B8313367716D1A672194DF10AfB8Bc7cfBdB0a` |
| Launchpad (AntcLaunchpad) | `0x9b8Ac46DCDe0EA76DaF48a3f370C6DA8A04586a8` |
| Test ANTC (tANTC, launchpad quote token) | `0xf0e40c26482adcd2d0e7eb3485e3208f96b4c277` |
| ArbSys (withdrawals) | `0x0000000000000000000000000000000000000064` |

Pair init code hash: `0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f`

## Mainnet (live)

### On Robinhood Chain (4663)

| Contract | Address |
|---|---|
| ANT Stock Token (gas token, issued by Robinhood) | `0xbbB6c29bCc3a1028A2B54310DF73F4F7A3bcB373` |
| Inbox (deposits) | `0x13be8403DdeA7826a6f46904344d4a9431c28Efa` |
| Bridge (escrow) | `0x3c7218E4E7a0819C3C83065d030BB3502AE76F1a` |
| Outbox (claims) | `0x745Eb8C2CF6B643d25f4391d3D6C92C318a63CA3` |
| Rollup | `0xe3A87D0cDA39c335cb2Bbaf4DE1f052fe41aeE06` |
| Sequencer inbox | `0xCBD854bbAf1580123cE9f7DF5bac3bFc6C33bf9E` |
| Fee token pricer | `0x87b35eb0ed8724250126fd16ba3c1f3509eeb2ab` |
| Token bridge router | `0xCFe1612bA1Fb5c98a6Aaed86c69cE3aE7f632228` |
| Standard gateway | `0x13Cb5e46C2758057582d27760DDC5052FaDC27c8` |

### On ANT CHAIN (26800)

| Contract | Address |
|---|---|
| Token bridge router | `0xcD71705cA05E7BE5Dd96E0030Ca943EcC78aEb9D` |
| Standard gateway | `0xf5a5B408Bc6Ef7Fe26AB826E5D158775aFc04fF7` |
| ArbSys (withdrawals) | `0x0000000000000000000000000000000000000064` |
| Exchange router (Uniswap V2 Router02) | `0x3Cd343c668cCBaEaE01326ffc721C840A1A1BefF` |
| Exchange factory (Uniswap V2) | `0xF7ba8FDa62e031252151D3c5b6F05C1dbA05459A` |
| Wrapped ANT | `0xf4dc96b75d44EE74a6a4Ea59004aa9f8AF4C1Bb4` |
| Launchpad (AntcLaunchpad) | `0x2BECe5405eE63844e6d14dF44c3aDE22AD3533dA` |
| FeeBurner (exchange fee to burned $ANTC) | `0x110797efDcBedD157920Faee8e020E51270348Fc` |
| $ANTC (bridged, standard gateway) | `0x65024Ab548EecDcCb686a3DcaC4DE2BF9b63042c` |

The mainnet exchange is open. Pools are created by their liquidity providers. Each swap pays 0.3%: 0.25% to liquidity providers and 0.05% to the FeeBurner, which turns it into $ANTC sent to `0x…dEaD` ([FeeBurner.sol](../chain/contracts/FeeBurner.sol)).

> **Beware of impostors.** A different token at `0x36c2861a1f94c6f277a388338a4f8a686e0d9b30` also uses the name "Anthropic" with a 1B supply. It is **not** the ANT Stock Token and has nothing to do with ANT CHAIN.

## $ANTC, the ANT CHAIN token

| | |
|---|---|
| Contract (Robinhood Chain, 4663) | `0x1A9ca5A347c4aeAb4870668E76506E45C23D6281` |
| Name / ticker | ANT Chain / ANTC |
| Supply / decimals | 1,000,000,000 / 18 |
| Launched on | [Pons](https://ponsfamily.com/launchpad/0x1A9ca5A347c4aeAb4870668E76506E45C23D6281) |
| Staking for gas credits (Robinhood Chain, 4663) | `0xfd0d05df472a932e6bc64ca34744c77fd3c7b1ac` |

Only this address is ours. Anything else using the name is not.
