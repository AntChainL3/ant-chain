# Slither report

Full output of [Slither](https://github.com/crytic/slither) 0.11.6 on `chain/contracts`, run on 24 November 2026 against commit [8fe7cbf](https://github.com/AntChainL3/ant-chain/tree/8fe7cbf8429e280db178c468ffefc3c92f4cc1be). Every line links to the code it refers to.

**0 High** · 9 Medium · 17 Low · 7 Informational. How each finding was assessed, and why none is exploitable: [static-analysis.md](static-analysis.md). The same scan runs on every push; the newest report is on the Summary page of the latest [CI run](https://github.com/AntChainL3/ant-chain/actions/workflows/ci.yml?query=branch%3Amain).

---

Summary
 - [divide-before-multiply](#divide-before-multiply) (4 results) (Medium)
 - [incorrect-equality](#incorrect-equality) (4 results) (Medium)
 - [reentrancy-no-eth](#reentrancy-no-eth) (1 results) (Medium)
 - [missing-zero-check](#missing-zero-check) (4 results) (Low)
 - [reentrancy-benign](#reentrancy-benign) (2 results) (Low)
 - [return-bomb](#return-bomb) (1 results) (Low)
 - [timestamp](#timestamp) (10 results) (Low)
 - [low-level-calls](#low-level-calls) (2 results) (Informational)
 - [naming-convention](#naming-convention) (2 results) (Informational)
 - [unindexed-event-address](#unindexed-event-address) (3 results) (Informational)
## divide-before-multiply
Impact: Medium
Confidence: Medium
 - [ ] ID-0
[AntcLaunchpad.quoteSell(address,uint256)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L232-L238) performs a multiplication on the result of a division:
	- [gross = (l.vQuote * tokensIn) / (l.vToken + tokensIn)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L235)
	- [quoteOut = gross - (gross * feeBps) / 10_000](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L237)

https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L232-L238


 - [ ] ID-1
[AntcLaunchpad.quoteBuy(address,uint256)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L216-L229) performs a multiplication on the result of a division:
	- [net = (l.vQuote * left + (l.vToken - left) - 1) / (l.vToken - left)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L226)
	- [quoteUsed = net + (net * feeBps + (10_000 - feeBps) - 1) / (10_000 - feeBps)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L227)

https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L216-L229


 - [ ] ID-2
[AntcLaunchpad._buy(address,uint256,uint256)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L168-L196) performs a multiplication on the result of a division:
	- [net = (l.vQuote * left + (l.vToken - left) - 1) / (l.vToken - left)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L179)
	- [fee = (net * feeBps + (10_000 - feeBps) - 1) / (10_000 - feeBps)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L180)

https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L168-L196


 - [ ] ID-3
[AntcLaunchpad.sell(address,uint256,uint256,uint256)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L146-L166) performs a multiplication on the result of a division:
	- [gross = (l.vQuote * tokensIn) / (l.vToken + tokensIn)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L151)
	- [fee = (gross * feeBps) / 10_000](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L153)

https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L146-L166


## incorrect-equality
Impact: Medium
Confidence: High
 - [ ] ID-4
[ANTcStaking.recover(IERC20,address)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/ANTcStaking.sol#L146-L152) uses a dangerous strict equality:
	- [amount == 0](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/ANTcStaking.sol#L149)

https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/ANTcStaking.sol#L146-L152


 - [ ] ID-5
[FeeBurner.unwind(address)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/FeeBurner.sol#L97-L106) uses a dangerous strict equality:
	- [liquidity == 0](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/FeeBurner.sol#L102)

https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/FeeBurner.sol#L97-L106


 - [ ] ID-6
[ANTcStaking.stake(uint256)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/ANTcStaking.sol#L67-L79) uses a dangerous strict equality:
	- [received == 0](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/ANTcStaking.sol#L75)

https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/ANTcStaking.sol#L67-L79


 - [ ] ID-7
[FeeBurner.burnAntc()](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/FeeBurner.sol#L129-L135) uses a dangerous strict equality:
	- [amount == 0](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/FeeBurner.sol#L131)

https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/FeeBurner.sol#L129-L135


## reentrancy-no-eth
Impact: Medium
Confidence: Medium
 - [ ] ID-8
Reentrancy in [AntcLaunchpad.create(string,string,string,uint256,uint256,uint256)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L98-L115):
	External calls:
	- [token = _newToken(name,symbol,metadata)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L113)
		- [pair = factory.createPair(token,address(quote))](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L120)
		- [LaunchToken(token).setPair(pair)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L121)
	- [tokensOut = _buy(token,buyQuote,minTokensOut)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L114)
		- [LaunchToken(token).markGraduated()](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L202)
		- [liquidity = IUniswapV2PairLike(l.pair).mint(DEAD)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L209)
	State variables written after the call(s):
	- [tokensOut = _buy(token,buyQuote,minTokensOut)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L114)
		- [l = launches[token]](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L281)
	[AntcLaunchpad.launches](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L67) can be used in cross function reentrancies:
	- [AntcLaunchpad.launches](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L67)
	- [AntcLaunchpad.priceOf(address)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L241-L245)
	- [AntcLaunchpad.quoteBuy(address,uint256)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L216-L229)
	- [AntcLaunchpad.quoteSell(address,uint256)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L232-L238)

https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L98-L115


## missing-zero-check
Impact: Low
Confidence: Medium
 - [ ] ID-9
[LaunchToken.setPair(address).pair_](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/LaunchToken.sol#L29) lacks a zero-check on :
		- [pair = pair_](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/LaunchToken.sol#L31)

https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/LaunchToken.sol#L29


 - [ ] ID-10
[AntFeeTokenPricer.constructor(address,address,AggregatorV3Interface,uint256).keeper_](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntFeeTokenPricer.sol#L65-L66) lacks a zero-check on :
		- [keeper = keeper_](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntFeeTokenPricer.sol#L70-L71)

https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntFeeTokenPricer.sol#L65-L66


 - [ ] ID-11
[AntFeeTokenPricer.setKeeper(address).k](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntFeeTokenPricer.sol#L175) lacks a zero-check on :
		- [keeper = k](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntFeeTokenPricer.sol#L176-L177)

https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntFeeTokenPricer.sol#L175


 - [ ] ID-12
[ANTcStaking.setRedeemer(address).redeemer_](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/ANTcStaking.sol#L133) lacks a zero-check on :
		- [redeemer = redeemer_](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/ANTcStaking.sol#L134)

https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/ANTcStaking.sol#L133


## reentrancy-benign
Impact: Low
Confidence: Medium
 - [ ] ID-13
Reentrancy in [FeeBurner.swapAndBurn(address[],uint256,uint256,uint256)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/FeeBurner.sol#L110-L126):
	External calls:
	- [router.swapExactTokensForTokensSupportingFeeOnTransferTokens(amountIn,minAntcOut,path,DEAD,deadline)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/FeeBurner.sol#L121)
	State variables written after the call(s):
	- [totalBurned += burned](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/FeeBurner.sol#L124)

https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/FeeBurner.sol#L110-L126


 - [ ] ID-14
Reentrancy in [AntcLaunchpad._newToken(string,string,string)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L117-L134):
	External calls:
	- [pair = factory.createPair(token,address(quote))](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L120)
	- [LaunchToken(token).setPair(pair)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L121)
	State variables written after the call(s):
	- [allTokens.push(token)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L132)
	- [l.creator = msg.sender](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L126)
	- [l.createdAt = uint96(block.timestamp)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L127)
	- [l.vQuote = v0](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L128)
	- [l.vToken = (CURVE_SUPPLY * (v0 + target)) / target](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L129)
	- [l.target = target](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L130)
	- [l.pair = pair](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L131)

https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L117-L134


## return-bomb
Impact: Low
Confidence: Medium
 - [ ] ID-15
[AntFeeTokenPricer._refreshEth()](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntFeeTokenPricer.sol#L99-L128) tries to limit the gas of an external call that controls implicit decoding
	[(ok,data) = address(ETH_USD_FEED).staticcall{gas: FEED_CALL_GAS}(abi.encodeWithSelector(AggregatorV3Interface.latestRoundData.selector))](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntFeeTokenPricer.sol#L100-L102)

https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntFeeTokenPricer.sol#L99-L128


## timestamp
Impact: Low
Confidence: Medium
 - [ ] ID-16
[TestANT.drip()](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/TestANT.sol#L27-L32) uses timestamp for comparisons
	Dangerous comparisons:
	- [lastDrip[msg.sender] != 0 && block.timestamp < next](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/TestANT.sol#L29)

https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/TestANT.sol#L27-L32


 - [ ] ID-17
[ANTcStaking.creditsOf(address)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/ANTcStaking.sol#L107-L111) uses timestamp for comparisons
	Dangerous comparisons:
	- [earned > spent](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/ANTcStaking.sol#L110)

https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/ANTcStaking.sol#L107-L111


 - [ ] ID-18
[AntFeeTokenPricer._refreshEth()](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntFeeTokenPricer.sol#L99-L128) uses timestamp for comparisons
	Dangerous comparisons:
	- [updatedAt > block.timestamp](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntFeeTokenPricer.sol#L110-L111)
	- [block.timestamp - updatedAt > ethFeedMaxAge](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntFeeTokenPricer.sol#L114-L115)
	- [updatedAt == ethUsdUpdatedAt](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntFeeTokenPricer.sol#L123)

https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntFeeTokenPricer.sol#L99-L128


 - [ ] ID-19
[AntcLaunchpad.buy(address,uint256,uint256,uint256)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L140-L143) uses timestamp for comparisons
	Dangerous comparisons:
	- [block.timestamp > deadline](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L141)

https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L140-L143


 - [ ] ID-20
[AntcLaunchpad.sell(address,uint256,uint256,uint256)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L146-L166) uses timestamp for comparisons
	Dangerous comparisons:
	- [block.timestamp > deadline](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L147)

https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L146-L166


 - [ ] ID-21
[AntcLaunchpad.create(string,string,string,uint256,uint256,uint256)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L98-L115) uses timestamp for comparisons
	Dangerous comparisons:
	- [block.timestamp > deadline](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L104)

https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L98-L115


 - [ ] ID-22
[TestUSD.drip()](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/TestUSD.sol#L23-L28) uses timestamp for comparisons
	Dangerous comparisons:
	- [lastDrip[msg.sender] != 0 && block.timestamp < next](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/TestUSD.sol#L25)

https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/TestUSD.sol#L23-L28


 - [ ] ID-23
[TestANTC.drip()](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/TestANTC.sol#L18-L23) uses timestamp for comparisons
	Dangerous comparisons:
	- [lastDrip[msg.sender] != 0 && block.timestamp < next](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/TestANTC.sol#L20)

https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/TestANTC.sol#L18-L23


 - [ ] ID-24
[AntFeeTokenPricer.submitAntPrice(uint256)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntFeeTokenPricer.sol#L146-L156) uses timestamp for comparisons
	Dangerous comparisons:
	- [block.timestamp < next](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntFeeTokenPricer.sol#L151)

https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntFeeTokenPricer.sol#L146-L156


 - [ ] ID-25
[ANTcStaking.spendCredits(address,uint256,bytes32)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/ANTcStaking.sol#L122-L129) uses timestamp for comparisons
	Dangerous comparisons:
	- [amount > available](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/ANTcStaking.sol#L126)

https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/ANTcStaking.sol#L122-L129


## low-level-calls
Impact: Informational
Confidence: High
 - [ ] ID-26
Low level call in [WrappedANT.withdraw(uint256)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/WrappedANT.sol#L29-L35):
	- [(ok,None) = msg.sender.call{value: wad}()](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/WrappedANT.sol#L33)

https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/WrappedANT.sol#L29-L35


 - [ ] ID-27
Low level call in [AntFeeTokenPricer._refreshEth()](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntFeeTokenPricer.sol#L99-L128):
	- [(ok,data) = address(ETH_USD_FEED).staticcall{gas: FEED_CALL_GAS}(abi.encodeWithSelector(AggregatorV3Interface.latestRoundData.selector))](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntFeeTokenPricer.sol#L100-L102)

https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntFeeTokenPricer.sol#L99-L128


## naming-convention
Impact: Informational
Confidence: High
 - [ ] ID-28
Variable [AntFeeTokenPricer.ETH_USD_FEED](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntFeeTokenPricer.sol#L33-L34) is not in mixedCase

https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntFeeTokenPricer.sol#L33-L34


 - [ ] ID-29
Variable [AntFeeTokenPricer.FEED_DECIMALS](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntFeeTokenPricer.sol#L34-L35) is not in mixedCase

https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntFeeTokenPricer.sol#L34-L35


## unindexed-event-address
Impact: Informational
Confidence: High
 - [ ] ID-30
Event [AntFeeTokenPricer.KeeperSet(address)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntFeeTokenPricer.sol#L51-L52) has address parameters but no indexed parameters

https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntFeeTokenPricer.sol#L51-L52


 - [ ] ID-31
Event [AntFeeTokenPricer.AntPriceUpdated(uint256,address)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntFeeTokenPricer.sol#L52-L55) has address parameters but no indexed parameters

https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntFeeTokenPricer.sol#L52-L55


 - [ ] ID-32
Event [AntcLaunchpad.ParamsChanged(uint16,uint16,uint256,uint256,address)](https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L73) has address parameters but no indexed parameters

https://github.com/AntChainL3/ant-chain/blob/8fe7cbf8429e280db178c468ffefc3c92f4cc1be/chain/contracts/AntcLaunchpad.sol#L73


