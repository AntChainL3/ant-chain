// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {FeeBurner, IFeeBurnerRouter} from "../contracts/FeeBurner.sol";
import {WrappedANT} from "../contracts/WrappedANT.sol";
import {AntcLaunchpad, IUniswapV2FactoryLike} from "../contracts/AntcLaunchpad.sol";

contract MockToken is ERC20 {
    constructor(string memory n, string memory s) ERC20(n, s) {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

interface IV2Factory {
    function setFeeTo(address) external;
    function feeTo() external view returns (address);
    function createPair(address, address) external returns (address);
    function getPair(address, address) external view returns (address);
}

interface IV2Pair {
    function getReserves() external view returns (uint112, uint112, uint32);
    function token0() external view returns (address);
    function totalSupply() external view returns (uint256);
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
    function burn(address) external returns (uint256, uint256);
}

interface IV2Router {
    function addLiquidity(address, address, uint256, uint256, uint256, uint256, address, uint256) external returns (uint256, uint256, uint256);
    function removeLiquidity(address, address, uint256, uint256, uint256, address, uint256) external returns (uint256, uint256);
    function swapExactTokensForTokens(uint256, uint256, address[] calldata, address, uint256) external returns (uint256[] memory);
    function getAmountsOut(uint256, address[] calldata) external view returns (uint256[] memory);
}

/// A pool look-alike that is not from the exchange factory.
contract FakePair {
    address public token0;
    address public token1;
    constructor(address a, address b) { token0 = a; token1 = b; }
    function balanceOf(address) external pure returns (uint256) { return 1; }
}

contract FeeBurnerTest is Test {
    address constant DEAD = 0x000000000000000000000000000000000000dEaD;
    IV2Factory factory;
    IV2Router router;
    WrappedANT want;
    MockToken antc;
    MockToken shog;
    FeeBurner burner;
    address owner = address(0xA11CE);
    address keeper = address(0x6EE9);
    address lp = address(0x1111);
    address trader = address(0x2222);
    address stranger = address(0xBAD);

    function _deploy(bytes memory init) internal returns (address a) {
        assembly { a := create(0, add(init, 0x20), mload(init)) }
        require(a != address(0), "deploy failed");
    }

    function setUp() public {
        // the official Uniswap V2 bytecode, exactly as deployed on ANT CHAIN
        bytes memory f = vm.parseJsonBytes(vm.readFile("node_modules/@uniswap/v2-core/build/UniswapV2Factory.json"), ".bytecode");
        factory = IV2Factory(_deploy(abi.encodePacked(f, abi.encode(address(this)))));
        want = new WrappedANT();
        bytes memory r = vm.parseJsonBytes(vm.readFile("node_modules/@uniswap/v2-periphery/build/UniswapV2Router02.json"), ".bytecode");
        router = IV2Router(_deploy(abi.encodePacked(r, abi.encode(address(factory), address(want)))));
        antc = new MockToken("ANT Chain", "ANTC");
        shog = new MockToken("Shoggoth", "SHOG");
        burner = new FeeBurner(IERC20(address(antc)), IFeeBurnerRouter(address(router)), owner, keeper);
        factory.setFeeTo(address(burner));

        vm.deal(lp, 1_000 ether);
        vm.deal(trader, 1_000 ether);
        vm.prank(lp);
        want.deposit{value: 1_000 ether}();
        vm.prank(trader);
        want.deposit{value: 1_000 ether}();
        for (uint256 i; i < 2; i++) {
            address u = [lp, trader][i];
            antc.mint(u, 1_000_000_000 ether);
            shog.mint(u, 1_000_000_000 ether);
            vm.startPrank(u);
            antc.approve(address(router), type(uint256).max);
            shog.approve(address(router), type(uint256).max);
            want.approve(address(router), type(uint256).max);
            vm.stopPrank();
        }
        // three pools like on mainnet: ANT/$ANTC, SHOG/$ANTC, SHOG/ANT
        _add(address(want), address(antc), 10 ether, 10_000_000 ether);
        _add(address(shog), address(antc), 100_000_000 ether, 10_000_000 ether);
        _add(address(shog), address(want), 100_000_000 ether, 10 ether);
    }

    function _add(address a, address b, uint256 x, uint256 y) internal {
        vm.prank(lp);
        router.addLiquidity(a, b, x, y, 0, 0, lp, block.timestamp);
    }

    function _swap(address a, address b, uint256 x) internal {
        address[] memory p = new address[](2);
        p[0] = a;
        p[1] = b;
        vm.prank(trader);
        router.swapExactTokensForTokens(x, 0, p, trader, block.timestamp);
    }

    function _path(address a, address b) internal pure returns (address[] memory p) {
        p = new address[](2);
        p[0] = a;
        p[1] = b;
    }

    function _path3(address a, address b, address c) internal pure returns (address[] memory p) {
        p = new address[](3);
        p[0] = a;
        p[1] = b;
        p[2] = c;
    }

    function _pair(address a, address b) internal view returns (address) {
        return factory.getPair(a, b);
    }

    /// Trade back and forth on a pool, then add a little liquidity so the protocol fee is minted.
    function _volume(address a, address b, uint256 x, uint256 rounds) internal {
        for (uint256 i; i < rounds; i++) {
            uint256 before = IERC20(b).balanceOf(trader);
            _swap(a, b, x);
            _swap(b, a, IERC20(b).balanceOf(trader) - before);
        }
        _add(a, b, x / 1000, _quoteFor(a, b, x / 1000));
    }

    function _quoteFor(address a, address b, uint256 x) internal view returns (uint256) {
        IV2Pair p = IV2Pair(_pair(a, b));
        (uint112 r0, uint112 r1,) = p.getReserves();
        (uint256 ra, uint256 rb) = p.token0() == a ? (uint256(r0), uint256(r1)) : (uint256(r1), uint256(r0));
        return x * rb / ra + 1;
    }

    // ------------------------------------------------------------ setup facts

    function test_constructorWiring() public view {
        assertEq(address(burner.antc()), address(antc));
        assertEq(address(burner.router()), address(router));
        assertEq(address(burner.factory()), address(factory));
        assertEq(burner.operator(), keeper);
        assertEq(burner.owner(), owner);
        assertEq(factory.feeTo(), address(burner));
    }

    function test_constructorRejectsZero() public {
        vm.expectRevert(FeeBurner.ZeroAddress.selector);
        new FeeBurner(IERC20(address(0)), IFeeBurnerRouter(address(router)), owner, keeper);
        vm.expectRevert(FeeBurner.ZeroAddress.selector);
        new FeeBurner(IERC20(address(antc)), IFeeBurnerRouter(address(router)), owner, address(0));
    }

    // ------------------------------------------------------------ the fee itself

    function test_protocolFeeIsOneSixthOfPoolFee() public {
        address pair = _pair(address(want), address(antc));
        uint256 volume;
        for (uint256 i; i < 20; i++) {
            uint256 before = antc.balanceOf(trader);
            _swap(address(want), address(antc), 0.5 ether);
            uint256 got = antc.balanceOf(trader) - before;
            _swap(address(antc), address(want), got);
            volume += 1 ether; // 0.5 ANT each way, measured in ANT
        }
        _add(address(want), address(antc), 0.001 ether, _quoteFor(address(want), address(antc), 0.001 ether));
        uint256 shares = IV2Pair(pair).balanceOf(address(burner));
        assertGt(shares, 0, "fee shares minted to the burner");
        // value of the burner's shares in ANT = 2 x its ANT side
        (uint112 r0, uint112 r1,) = IV2Pair(pair).getReserves();
        uint256 rAnt = IV2Pair(pair).token0() == address(want) ? r0 : r1;
        uint256 valueAnt = 2 * rAnt * shares / IV2Pair(pair).totalSupply();
        // 0.05% of volume, within 10% (price moves and rounding)
        uint256 expected = volume * 5 / 10_000;
        assertApproxEqRel(valueAnt, expected, 0.1e18);
    }

    function test_tradersStillPayThreeTenthsPercent() public {
        // the fee switch does not change what a swap returns
        address[] memory p = _path(address(want), address(antc));
        uint256 quoted = router.getAmountsOut(1 ether, p)[1];
        uint256 before = antc.balanceOf(trader);
        _swap(address(want), address(antc), 1 ether);
        assertEq(antc.balanceOf(trader) - before, quoted);
    }

    // ------------------------------------------------------------ unwind, swap, burn

    function test_fullCycleBurnsOnlyAntc() public {
        _volume(address(want), address(antc), 1 ether, 10);
        _volume(address(shog), address(antc), 10_000_000 ether, 10);
        _volume(address(shog), address(want), 10_000_000 ether, 10);

        address p1 = _pair(address(want), address(antc));
        address p2 = _pair(address(shog), address(antc));
        address p3 = _pair(address(shog), address(want));
        vm.startPrank(stranger); // unwinding is open to anyone
        burner.unwind(p1);
        burner.unwind(p2);
        burner.unwind(p3);
        vm.stopPrank();
        assertEq(IV2Pair(p1).balanceOf(address(burner)), 0);

        uint256 wantHeld = want.balanceOf(address(burner));
        uint256 shogHeld = shog.balanceOf(address(burner));
        uint256 antcHeld = antc.balanceOf(address(burner));
        assertGt(wantHeld, 0);
        assertGt(shogHeld, 0);
        assertGt(antcHeld, 0);

        uint256 deadBefore = antc.balanceOf(DEAD);
        vm.startPrank(keeper);
        uint256 b1 = burner.swapAndBurn(_path(address(want), address(antc)), wantHeld, 1, block.timestamp);
        uint256 b2 = burner.swapAndBurn(_path(address(shog), address(antc)), shogHeld, 1, block.timestamp);
        vm.stopPrank();
        vm.prank(stranger);
        uint256 b3 = burner.burnAntc();

        assertEq(b3, antcHeld);
        assertEq(antc.balanceOf(DEAD) - deadBefore, b1 + b2 + b3);
        assertEq(burner.totalBurned(), b1 + b2 + b3);
        assertEq(want.balanceOf(address(burner)), 0);
        assertEq(shog.balanceOf(address(burner)), 0);
        assertEq(antc.balanceOf(address(burner)), 0);
        assertEq(want.allowance(address(burner), address(router)), 0, "no allowance left behind");
        assertEq(shog.allowance(address(burner), address(router)), 0, "no allowance left behind");
    }

    function test_threeHopPathWorks() public {
        _volume(address(shog), address(want), 10_000_000 ether, 5);
        burner.unwind(_pair(address(shog), address(want)));
        uint256 s = shog.balanceOf(address(burner));
        uint256 deadBefore = antc.balanceOf(DEAD);
        vm.prank(keeper);
        uint256 burned = burner.swapAndBurn(_path3(address(shog), address(want), address(antc)), s, 1, block.timestamp);
        assertGt(burned, 0);
        assertEq(antc.balanceOf(DEAD) - deadBefore, burned);
    }

    function test_partialSwapLeavesRestForLater() public {
        _volume(address(want), address(antc), 1 ether, 10);
        burner.unwind(_pair(address(want), address(antc)));
        uint256 w = want.balanceOf(address(burner));
        vm.prank(keeper);
        burner.swapAndBurn(_path(address(want), address(antc)), w / 2, 1, block.timestamp);
        assertEq(want.balanceOf(address(burner)), w - w / 2);
    }

    function test_unwindKeepsFeeFlowing() public {
        address pair = _pair(address(want), address(antc));
        _volume(address(want), address(antc), 1 ether, 5);
        burner.unwind(pair);
        // the unwind itself mints the fee earned since the last liquidity event
        _volume(address(want), address(antc), 1 ether, 5);
        assertGt(IV2Pair(pair).balanceOf(address(burner)), 0);
        burner.unwind(pair);
    }

    // ------------------------------------------------------------ guards

    function test_onlyOperatorOrOwnerSwaps() public {
        _volume(address(want), address(antc), 1 ether, 3);
        burner.unwind(_pair(address(want), address(antc)));
        address[] memory p = _path(address(want), address(antc));
        vm.prank(stranger);
        vm.expectRevert(FeeBurner.NotOperator.selector);
        burner.swapAndBurn(p, 1, 0, block.timestamp);
        vm.prank(owner);
        burner.swapAndBurn(p, 1e9, 0, block.timestamp);
    }

    function test_pathMustEndInAntc() public {
        _volume(address(want), address(antc), 1 ether, 3);
        burner.unwind(_pair(address(want), address(antc)));
        vm.startPrank(keeper);
        vm.expectRevert(FeeBurner.BadPath.selector);
        burner.swapAndBurn(_path(address(antc), address(want)), 1, 0, block.timestamp); // $ANTC out of the burner
        vm.expectRevert(FeeBurner.BadPath.selector);
        burner.swapAndBurn(_path(address(want), address(shog)), 1, 0, block.timestamp); // does not end in $ANTC
        address[] memory one = new address[](1);
        one[0] = address(antc);
        vm.expectRevert(FeeBurner.BadPath.selector);
        burner.swapAndBurn(one, 1, 0, block.timestamp);
        address[] memory five = new address[](5);
        five[4] = address(antc);
        vm.expectRevert(FeeBurner.BadPath.selector);
        burner.swapAndBurn(five, 1, 0, block.timestamp);
        vm.expectRevert(FeeBurner.BadPath.selector);
        burner.swapAndBurn(_path3(address(antc), address(want), address(antc)), 1, 0, block.timestamp);
        vm.stopPrank();
    }

    function test_minimumOutIsEnforced() public {
        _volume(address(want), address(antc), 1 ether, 3);
        burner.unwind(_pair(address(want), address(antc)));
        uint256 w = want.balanceOf(address(burner));
        uint256 q = router.getAmountsOut(w, _path(address(want), address(antc)))[1];
        vm.prank(keeper);
        vm.expectRevert(bytes("UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT"));
        burner.swapAndBurn(_path(address(want), address(antc)), w, q + 1, block.timestamp);
    }

    function test_unwindRejectsFakePairsAndEmpty() public {
        FakePair fake = new FakePair(address(want), address(antc));
        vm.expectRevert(FeeBurner.NotAnExchangePair.selector);
        burner.unwind(address(fake));
        address pair = _pair(address(want), address(antc));
        vm.expectRevert(FeeBurner.NothingToUnwind.selector);
        burner.unwind(pair);
        vm.expectRevert(FeeBurner.NothingToBurn.selector);
        burner.burnAntc();
    }

    function test_cannotSwapMoreThanHeld() public {
        vm.prank(keeper);
        vm.expectRevert();
        burner.swapAndBurn(_path(address(want), address(antc)), 1 ether, 0, block.timestamp);
    }

    function test_onlyOwnerSetsOperator() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        burner.setOperator(stranger);
        vm.prank(owner);
        vm.expectRevert(FeeBurner.ZeroAddress.selector);
        burner.setOperator(address(0));
        vm.prank(owner);
        burner.setOperator(stranger);
        assertEq(burner.operator(), stranger);
        vm.prank(keeper);
        vm.expectRevert(FeeBurner.NotOperator.selector);
        burner.swapAndBurn(_path(address(want), address(antc)), 1, 0, block.timestamp);
    }

    function test_rejectsPlainAnt() public {
        vm.deal(stranger, 1 ether);
        vm.prank(stranger);
        (bool ok,) = address(burner).call{value: 1 ether}("");
        assertFalse(ok, "no way to park native ANT here");
    }

    // ------------------------------------------------------------ fuzz: nothing ever leaves except to the dead address

    function testFuzz_valueOnlyGoesToDead(uint96 x1, uint96 x2, uint8 rounds) public {
        uint256 a = bound(uint256(x1), 0.01 ether, 5 ether);
        uint256 b = bound(uint256(x2), 1_000 ether, 20_000_000 ether);
        uint256 n = bound(uint256(rounds), 1, 6);
        _volume(address(want), address(antc), a, n);
        _volume(address(shog), address(antc), b, n);

        uint256 deadBefore = antc.balanceOf(DEAD);
        uint256 keeperBefore = antc.balanceOf(keeper) + want.balanceOf(keeper) + shog.balanceOf(keeper);
        burner.unwind(_pair(address(want), address(antc)));
        burner.unwind(_pair(address(shog), address(antc)));
        uint256 w = want.balanceOf(address(burner));
        uint256 s = shog.balanceOf(address(burner));
        uint256 c = antc.balanceOf(address(burner));
        vm.startPrank(keeper);
        uint256 b1 = w > 0 ? burner.swapAndBurn(_path(address(want), address(antc)), w, 0, block.timestamp) : 0;
        uint256 b2 = s > 0 ? burner.swapAndBurn(_path(address(shog), address(antc)), s, 0, block.timestamp) : 0;
        vm.stopPrank();
        uint256 b3 = c > 0 ? burner.burnAntc() : 0;
        assertEq(antc.balanceOf(DEAD) - deadBefore, b1 + b2 + b3);
        assertEq(antc.balanceOf(keeper) + want.balanceOf(keeper) + shog.balanceOf(keeper), keeperBefore, "operator gets nothing");
        assertEq(want.balanceOf(address(burner)) + shog.balanceOf(address(burner)) + antc.balanceOf(address(burner)), 0);
    }

    // ------------------------------------------------------------ the launchpad keeps working with the fee on

    function test_launchpadGraduatesWithFeeOn() public {
        AntcLaunchpad pad = new AntcLaunchpad(IERC20(address(antc)), IUniswapV2FactoryLike(address(factory)), owner, 300_000 ether, owner);
        vm.startPrank(trader);
        antc.approve(address(pad), type(uint256).max);
        (address token,) = pad.create("Fee Test", "FEET", "{}", 0, 0, block.timestamp);
        pad.buy(token, 5_000_000 ether, 0, block.timestamp); // sells out the curve: graduates
        vm.stopPrank();
        (, , , , , , , address pair, bool grad) = pad.launches(token);
        assertTrue(grad);
        assertEq(IV2Pair(pair).balanceOf(address(burner)), 0, "no fee on the first deposit");

        // trade the graduated token, then the next liquidity event mints the fee
        vm.prank(trader);
        IERC20(token).approve(address(router), type(uint256).max);
        for (uint256 i; i < 5; i++) {
            uint256 before = IERC20(token).balanceOf(trader);
            _swap(address(antc), token, 10_000 ether);
            _swap(token, address(antc), IERC20(token).balanceOf(trader) - before);
        }
        uint256 tq = _quoteFor(address(antc), token, 1 ether);
        vm.startPrank(trader);
        router.addLiquidity(address(antc), token, 1 ether, tq, 0, 0, trader, block.timestamp);
        vm.stopPrank();
        assertGt(IV2Pair(pair).balanceOf(address(burner)), 0);

        burner.unwind(pair);
        uint256 t = IERC20(token).balanceOf(address(burner));
        vm.prank(keeper);
        assertGt(burner.swapAndBurn(_path(token, address(antc)), t, 1, block.timestamp), 0);
        burner.burnAntc();
    }
}
