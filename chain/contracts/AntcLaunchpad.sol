// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {LaunchToken} from "./LaunchToken.sol";

interface IUniswapV2FactoryLike {
    function getPair(address, address) external view returns (address);
    function createPair(address, address) external returns (address);
}

interface IUniswapV2PairLike {
    function mint(address to) external returns (uint256);
}

/// @title AntcLaunchpad
/// @notice Token launchpad on ANT CHAIN where every trade is paid in $ANTC (the quote token).
///
/// Each token has a fixed supply of 1,000,000,000. 800,000,000 are sold on a bonding curve
/// (virtual constant product, like pump.fun). When they are sold out, the token graduates:
/// the other 200,000,000 and all $ANTC the curve raised go into a Uniswap V2 pool on the
/// ANT CHAIN exchange, and the pool shares are sent to a dead address so the liquidity can
/// never be withdrawn. The curve's last price equals the pool's first price.
///
/// A trading fee (default 1%) is taken in $ANTC: part is burned (sent to the dead address),
/// the rest goes to the treasury.
///
/// The owner can change the fee (capped at 2%), the fee split, the treasury, the creation fee
/// and the graduation target for NEW launches, and pause new launches. The owner can never
/// move the $ANTC or tokens held for a launch, and can never stop selling back to a curve.
contract AntcLaunchpad is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether;
    uint256 public constant CURVE_SUPPLY = 800_000_000 ether;
    uint256 public constant POOL_SUPPLY = 200_000_000 ether;
    uint256 public constant MAX_FEE_BPS = 200;
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    /// @notice $ANTC on ANT CHAIN: every price, trade and fee is in this token.
    IERC20 public immutable quote;
    /// @notice Uniswap V2 factory of the ANT CHAIN exchange (where tokens graduate to).
    IUniswapV2FactoryLike public immutable factory;

    address public treasury;
    uint16 public feeBps = 100; // 1%
    uint16 public burnShareBps = 5000; // half of each fee is burned
    uint256 public createFee; // $ANTC paid to create a token (anti-spam), split like trading fees
    uint256 public graduationTarget; // $ANTC a curve raises before it graduates (for new launches)
    bool public launchesOpen = true;

    struct Launch {
        address creator;
        uint96 createdAt;
        uint256 vQuote; // virtual $ANTC reserve
        uint256 vToken; // virtual token reserve
        uint256 realQuote; // $ANTC actually held for this launch
        uint256 sold; // tokens sold by the curve and not bought back
        uint256 target; // graduation target fixed at launch
        address pair;
        bool graduated;
    }

    mapping(address => Launch) public launches;
    address[] public allTokens;

    event Launched(address indexed token, address indexed creator, string name, string symbol, string metadata, address pair, uint256 target);
    event Trade(address indexed token, address indexed trader, bool isBuy, uint256 quoteAmount, uint256 tokenAmount, uint256 fee, uint256 vQuote, uint256 vToken);
    event Graduated(address indexed token, address indexed pair, uint256 quoteAmount, uint256 tokenAmount, uint256 liquidity);
    event ParamsChanged(uint16 feeBps, uint16 burnShareBps, uint256 createFee, uint256 graduationTarget, address treasury);
    event LaunchesOpen(bool open);

    error LaunchesClosed();
    error UnknownToken();
    error AlreadyGraduated();
    error ZeroAmount();
    error Slippage();
    error Expired();
    error BadParam();
    error NameRequired();

    constructor(IERC20 quote_, IUniswapV2FactoryLike factory_, address treasury_, uint256 graduationTarget_, address owner_) Ownable(owner_) {
        if (address(quote_) == address(0) || address(factory_) == address(0) || treasury_ == address(0)) revert BadParam();
        if (graduationTarget_ < 3_000) revert BadParam();
        quote = quote_;
        factory = factory_;
        treasury = treasury_;
        graduationTarget = graduationTarget_;
    }

    // ---------------------------------------------------------------- create

    /// @notice Create a token and, optionally, buy some of it right away in the same transaction.
    /// @param metadata free text for the UI (for example JSON with a description, image URL and links)
    function create(string calldata name, string calldata symbol, string calldata metadata, uint256 buyQuote, uint256 minTokensOut, uint256 deadline)
        external
        nonReentrant
        returns (address token, uint256 tokensOut)
    {
        if (!launchesOpen) revert LaunchesClosed();
        if (block.timestamp > deadline) revert Expired();
        if (bytes(name).length == 0 || bytes(name).length > 64 || bytes(symbol).length == 0 || bytes(symbol).length > 16) revert NameRequired();
        if (bytes(metadata).length > 2048) revert BadParam();

        if (createFee > 0) {
            quote.safeTransferFrom(msg.sender, address(this), createFee);
            _payFee(createFee);
        }

        token = _newToken(name, symbol, metadata);
        if (buyQuote > 0) tokensOut = _buy(token, buyQuote, minTokensOut);
    }

    function _newToken(string calldata name, string calldata symbol, string calldata metadata) internal returns (address token) {
        token = address(new LaunchToken(name, symbol, TOTAL_SUPPLY));
        address pair = factory.getPair(token, address(quote));
        if (pair == address(0)) pair = factory.createPair(token, address(quote));
        LaunchToken(token).setPair(pair);

        uint256 target = graduationTarget;
        uint256 v0 = target / 3; // makes the curve's last price equal the pool's first price
        Launch storage l = launches[token];
        l.creator = msg.sender;
        l.createdAt = uint96(block.timestamp);
        l.vQuote = v0;
        l.vToken = (CURVE_SUPPLY * (v0 + target)) / target;
        l.target = target;
        l.pair = pair;
        allTokens.push(token);
        emit Launched(token, msg.sender, name, symbol, metadata, pair, target);
    }

    // ---------------------------------------------------------------- trade

    /// @notice Buy a token with `quoteIn` $ANTC (fee included). If the curve sells out, only the
    /// $ANTC needed is taken and the token graduates in the same transaction.
    function buy(address token, uint256 quoteIn, uint256 minTokensOut, uint256 deadline) external nonReentrant returns (uint256 tokensOut) {
        if (block.timestamp > deadline) revert Expired();
        tokensOut = _buy(token, quoteIn, minTokensOut);
    }

    /// @notice Sell `tokensIn` back to the curve for $ANTC (fee taken from the output).
    function sell(address token, uint256 tokensIn, uint256 minQuoteOut, uint256 deadline) external nonReentrant returns (uint256 quoteOut) {
        if (block.timestamp > deadline) revert Expired();
        Launch storage l = _live(token);
        if (tokensIn == 0) revert ZeroAmount();

        uint256 gross = (l.vQuote * tokensIn) / (l.vToken + tokensIn);
        if (gross > l.realQuote) gross = l.realQuote; // never pay out more than this launch holds
        uint256 fee = (gross * feeBps) / 10_000;
        quoteOut = gross - fee;
        if (quoteOut == 0 || quoteOut < minQuoteOut) revert Slippage();

        l.vQuote -= gross;
        l.vToken += tokensIn;
        l.realQuote -= gross;
        l.sold -= tokensIn;

        IERC20(token).safeTransferFrom(msg.sender, address(this), tokensIn);
        quote.safeTransfer(msg.sender, quoteOut);
        _payFee(fee);
        emit Trade(token, msg.sender, false, quoteOut, tokensIn, fee, l.vQuote, l.vToken);
    }

    function _buy(address token, uint256 quoteIn, uint256 minTokensOut) internal returns (uint256 tokensOut) {
        Launch storage l = _live(token);
        if (quoteIn == 0) revert ZeroAmount();

        uint256 fee = (quoteIn * feeBps) / 10_000;
        uint256 net = quoteIn - fee;
        tokensOut = (l.vToken * net) / (l.vQuote + net);
        uint256 left = CURVE_SUPPLY - l.sold;
        if (tokensOut >= left) {
            // sell out exactly: charge only what the remaining tokens cost (rounded up)
            tokensOut = left;
            net = (l.vQuote * left + (l.vToken - left) - 1) / (l.vToken - left);
            fee = (net * feeBps + (10_000 - feeBps) - 1) / (10_000 - feeBps);
            quoteIn = net + fee;
        }
        if (tokensOut == 0 || tokensOut < minTokensOut) revert Slippage();

        l.vQuote += net;
        l.vToken -= tokensOut;
        l.realQuote += net;
        l.sold += tokensOut;

        quote.safeTransferFrom(msg.sender, address(this), quoteIn);
        IERC20(token).safeTransfer(msg.sender, tokensOut);
        _payFee(fee);
        emit Trade(token, msg.sender, true, quoteIn, tokensOut, fee, l.vQuote, l.vToken);

        if (l.sold == CURVE_SUPPLY) _graduate(token, l);
    }

    // ---------------------------------------------------------------- graduation

    function _graduate(address token, Launch storage l) internal {
        l.graduated = true;
        LaunchToken(token).markGraduated();
        uint256 q = l.realQuote;
        l.realQuote = 0;
        // Fund the pool directly and mint, instead of going through the router: anything someone
        // donated to the pair beforehand just becomes part of the pool and cannot block this.
        IERC20(token).safeTransfer(l.pair, POOL_SUPPLY);
        quote.safeTransfer(l.pair, q);
        uint256 liquidity = IUniswapV2PairLike(l.pair).mint(DEAD);
        emit Graduated(token, l.pair, q, POOL_SUPPLY, liquidity);
    }

    // ---------------------------------------------------------------- views

    /// @notice Tokens received for `quoteIn` $ANTC (fee included), and the $ANTC actually taken.
    function quoteBuy(address token, uint256 quoteIn) external view returns (uint256 tokensOut, uint256 quoteUsed) {
        Launch storage l = launches[token];
        if (l.creator == address(0) || l.graduated || quoteIn == 0) return (0, 0);
        uint256 fee = (quoteIn * feeBps) / 10_000;
        uint256 net = quoteIn - fee;
        tokensOut = (l.vToken * net) / (l.vQuote + net);
        quoteUsed = quoteIn;
        uint256 left = CURVE_SUPPLY - l.sold;
        if (tokensOut >= left) {
            tokensOut = left;
            net = (l.vQuote * left + (l.vToken - left) - 1) / (l.vToken - left);
            quoteUsed = net + (net * feeBps + (10_000 - feeBps) - 1) / (10_000 - feeBps);
        }
    }

    /// @notice $ANTC received (after fee) for selling `tokensIn` back to the curve.
    function quoteSell(address token, uint256 tokensIn) external view returns (uint256 quoteOut) {
        Launch storage l = launches[token];
        if (l.creator == address(0) || l.graduated || tokensIn == 0) return 0;
        uint256 gross = (l.vQuote * tokensIn) / (l.vToken + tokensIn);
        if (gross > l.realQuote) gross = l.realQuote;
        quoteOut = gross - (gross * feeBps) / 10_000;
    }

    /// @notice Current curve price in $ANTC per whole token (18 decimals).
    function priceOf(address token) external view returns (uint256) {
        Launch storage l = launches[token];
        if (l.vToken == 0) return 0;
        return (l.vQuote * 1e18) / l.vToken;
    }

    function tokenCount() external view returns (uint256) {
        return allTokens.length;
    }

    /// @notice A page of tokens, newest first.
    function tokensPage(uint256 offset, uint256 limit) external view returns (address[] memory page) {
        uint256 n = allTokens.length;
        if (offset >= n) return new address[](0);
        uint256 end = offset + limit > n ? n : offset + limit;
        page = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) page[i - offset] = allTokens[n - 1 - i];
    }

    // ---------------------------------------------------------------- owner

    function setParams(uint16 feeBps_, uint16 burnShareBps_, uint256 createFee_, uint256 graduationTarget_, address treasury_) external onlyOwner {
        if (feeBps_ > MAX_FEE_BPS || burnShareBps_ > 10_000 || treasury_ == address(0) || graduationTarget_ < 3_000) revert BadParam();
        feeBps = feeBps_;
        burnShareBps = burnShareBps_;
        createFee = createFee_;
        graduationTarget = graduationTarget_;
        treasury = treasury_;
        emit ParamsChanged(feeBps_, burnShareBps_, createFee_, graduationTarget_, treasury_);
    }

    /// @notice Pause or resume NEW launches. Trading on existing curves is never paused.
    function setLaunchesOpen(bool open) external onlyOwner {
        launchesOpen = open;
        emit LaunchesOpen(open);
    }

    // ---------------------------------------------------------------- internal

    function _live(address token) internal view returns (Launch storage l) {
        l = launches[token];
        if (l.creator == address(0)) revert UnknownToken();
        if (l.graduated) revert AlreadyGraduated();
    }

    function _payFee(uint256 fee) internal {
        if (fee == 0) return;
        uint256 burn = (fee * burnShareBps) / 10_000;
        if (burn > 0) quote.safeTransfer(DEAD, burn);
        if (fee - burn > 0) quote.safeTransfer(treasury, fee - burn);
    }
}
