// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AntcLaunchpad, IUniswapV2FactoryLike} from "../contracts/AntcLaunchpad.sol";
import {LaunchToken} from "../contracts/LaunchToken.sol";

contract MockANTC is ERC20 {
    constructor() ERC20("Mock ANTC", "ANTC") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

interface IPair {
    function getReserves() external view returns (uint112, uint112, uint32);
    function token0() external view returns (address);
    function totalSupply() external view returns (uint256);
    function balanceOf(address) external view returns (uint256);
    function mint(address) external returns (uint256);
    function sync() external;
}

contract AntcLaunchpadTest is Test {
    MockANTC antc;
    AntcLaunchpad pad;
    IUniswapV2FactoryLike factory;
    address owner = address(0xA11CE);
    address treasury = address(0x7EA5);
    address alice = address(0xA1);
    address bob = address(0xB0B);
    address carol = address(0xCA201);
    uint256 constant TARGET = 300_000 ether; // $ANTC raised before graduation
    address constant DEAD = 0x000000000000000000000000000000000000dEaD;

    function setUp() public {
        antc = new MockANTC();
        bytes memory code = vm.parseJsonBytes(vm.readFile("node_modules/@uniswap/v2-core/build/UniswapV2Factory.json"), ".bytecode");
        bytes memory init = abi.encodePacked(code, abi.encode(address(0)));
        address f;
        assembly { f := create(0, add(init, 0x20), mload(init)) }
        require(f != address(0), "factory deploy failed");
        factory = IUniswapV2FactoryLike(f);
        pad = new AntcLaunchpad(IERC20(address(antc)), factory, treasury, TARGET, owner);
        for (uint256 i; i < 3; i++) {
            address u = [alice, bob, carol][i];
            antc.mint(u, 10_000_000 ether);
            vm.prank(u);
            antc.approve(address(pad), type(uint256).max);
        }
    }

    function _launch(address who) internal returns (address token) {
        vm.prank(who);
        (token,) = pad.create("Test Token", "TEST", '{"description":"hi"}', 0, 0, block.timestamp);
    }

    function _buy(address who, address token, uint256 q) internal returns (uint256 out) {
        vm.prank(who);
        out = pad.buy(token, q, 0, block.timestamp);
    }

    function _sell(address who, address token, uint256 t) internal returns (uint256 out) {
        vm.startPrank(who);
        IERC20(token).approve(address(pad), t);
        out = pad.sell(token, t, 0, block.timestamp);
        vm.stopPrank();
    }

    function _launchView(address token) internal view returns (uint256 vQ, uint256 vT, uint256 realQ, uint256 sold, address pair, bool grad) {
        (, , vQ, vT, realQ, sold, , pair, grad) = pad.launches(token);
    }

    // ------------------------------------------------------------ create

    function test_createMintsSupplyToPadAndMakesPair() public {
        address token = _launch(alice);
        assertEq(IERC20(token).totalSupply(), 1_000_000_000 ether);
        assertEq(IERC20(token).balanceOf(address(pad)), 1_000_000_000 ether);
        (, , , , , address pair,) = _first(token);
        assertEq(pair, factory.getPair(token, address(antc)));
        assertEq(LaunchToken(token).pair(), pair);
        assertEq(pad.tokenCount(), 1);
    }

    function _first(address token) internal view returns (uint256, uint256, uint256, uint256, uint256, address, bool) {
        (uint256 vQ, uint256 vT, uint256 realQ, uint256 sold, address pair, bool grad) = _launchView(token);
        return (vQ, vT, realQ, sold, 0, pair, grad);
    }

    function test_createWithInitialBuy() public {
        vm.prank(alice);
        (address token, uint256 out) = pad.create("A", "A", "", 1_000 ether, 1, block.timestamp);
        assertGt(out, 0);
        assertEq(IERC20(token).balanceOf(alice), out);
    }

    function test_createRejectsBadNames() public {
        vm.prank(alice);
        vm.expectRevert(AntcLaunchpad.NameRequired.selector);
        pad.create("", "A", "", 0, 0, block.timestamp);
        vm.prank(alice);
        vm.expectRevert(AntcLaunchpad.NameRequired.selector);
        pad.create("A", "SEVENTEENCHARSXXX", "", 0, 0, block.timestamp);
    }

    function test_createFeeIsCharged() public {
        vm.prank(owner);
        pad.setParams(100, 5000, 100 ether, TARGET, treasury);
        uint256 before = antc.balanceOf(alice);
        _launch(alice);
        assertEq(before - antc.balanceOf(alice), 100 ether);
        assertEq(antc.balanceOf(DEAD), 50 ether);
        assertEq(antc.balanceOf(treasury), 50 ether);
    }

    function test_launchesCanBeClosedButTradingContinues() public {
        address token = _launch(alice);
        _buy(bob, token, 1_000 ether);
        vm.prank(owner);
        pad.setLaunchesOpen(false);
        vm.prank(alice);
        vm.expectRevert(AntcLaunchpad.LaunchesClosed.selector);
        pad.create("B", "B", "", 0, 0, block.timestamp);
        uint256 t = IERC20(token).balanceOf(bob);
        assertGt(_sell(bob, token, t), 0);
    }

    // ------------------------------------------------------------ trading

    function test_buyThenSellLosesOnlyFees() public {
        address token = _launch(alice);
        uint256 q = 10_000 ether;
        uint256 out = _buy(bob, token, q);
        uint256 back = _sell(bob, token, out);
        assertLt(back, q);
        // two 1% fees, nothing else (plus rounding)
        assertApproxEqRel(back, (q * 99 / 100) * 99 / 100, 1e12);
    }

    function test_priceRisesWithBuys() public {
        address token = _launch(alice);
        uint256 p0 = pad.priceOf(token);
        _buy(bob, token, 5_000 ether);
        assertGt(pad.priceOf(token), p0);
    }

    function test_feesSplitBurnAndTreasury() public {
        address token = _launch(alice);
        _buy(bob, token, 10_000 ether);
        assertEq(antc.balanceOf(DEAD), 50 ether);
        assertEq(antc.balanceOf(treasury), 50 ether);
    }

    function test_slippageAndDeadline() public {
        address token = _launch(alice);
        (uint256 expected,) = pad.quoteBuy(token, 1_000 ether);
        vm.prank(bob);
        vm.expectRevert(AntcLaunchpad.Slippage.selector);
        pad.buy(token, 1_000 ether, expected + 1, block.timestamp);
        vm.prank(bob);
        vm.expectRevert(AntcLaunchpad.Expired.selector);
        pad.buy(token, 1_000 ether, 0, block.timestamp - 1);
        vm.prank(bob);
        uint256 got = pad.buy(token, 1_000 ether, expected, block.timestamp);
        assertEq(got, expected);
    }

    function test_quoteSellMatchesSell() public {
        address token = _launch(alice);
        uint256 out = _buy(bob, token, 20_000 ether);
        uint256 q = pad.quoteSell(token, out / 2);
        assertEq(_sell(bob, token, out / 2), q);
    }

    function test_unknownToken() public {
        vm.prank(bob);
        vm.expectRevert(AntcLaunchpad.UnknownToken.selector);
        pad.buy(address(0x1234), 1 ether, 0, block.timestamp);
    }

    // ------------------------------------------------------------ pool protection before graduation

    function test_cannotSendTokenToPoolBeforeGraduation() public {
        address token = _launch(alice);
        uint256 out = _buy(bob, token, 10_000 ether);
        address pair = LaunchToken(token).pair();
        vm.prank(bob);
        vm.expectRevert(LaunchToken.PoolOpensAtGraduation.selector);
        IERC20(token).transfer(pair, out);
        // ordinary transfers between wallets still work
        vm.prank(bob);
        IERC20(token).transfer(carol, out);
        assertEq(IERC20(token).balanceOf(carol), out);
    }

    function test_onlyLaunchpadControlsToken() public {
        address token = _launch(alice);
        vm.expectRevert(LaunchToken.OnlyLaunchpad.selector);
        LaunchToken(token).markGraduated();
        vm.expectRevert(LaunchToken.OnlyLaunchpad.selector);
        LaunchToken(token).setPair(address(1));
    }

    // ------------------------------------------------------------ graduation

    function _sellOut(address token) internal {
        // buy far more than needed: only the cost of the remaining tokens is charged
        _buy(carol, token, 5_000_000 ether);
    }

    function test_graduatesAtCurveEndPrice() public {
        address token = _launch(alice);
        _buy(bob, token, 50_000 ether);
        uint256 carolBefore = antc.balanceOf(carol);
        _sellOut(token);
        uint256 spent = carolBefore - antc.balanceOf(carol);
        assertLt(spent, 5_000_000 ether, "excess must not be charged");

        (uint256 vQ, uint256 vT, uint256 realQ, uint256 sold, address pair, bool grad) = _launchView(token);
        assertTrue(grad);
        assertTrue(LaunchToken(token).graduated());
        assertEq(sold, 800_000_000 ether);
        assertEq(realQ, 0);

        (uint112 r0, uint112 r1,) = IPair(pair).getReserves();
        (uint256 rToken, uint256 rQuote) = IPair(pair).token0() == token ? (uint256(r0), uint256(r1)) : (uint256(r1), uint256(r0));
        assertEq(rToken, 200_000_000 ether);
        assertApproxEqRel(rQuote, TARGET, 1e15, "raises about the target");
        // pool's first price == curve's last price
        assertApproxEqRel((rQuote * 1e18) / rToken, (vQ * 1e18) / vT, 1e12);
        // liquidity is locked forever
        assertEq(IPair(pair).balanceOf(DEAD), IPair(pair).totalSupply() - 1000);
        // nothing left behind except the pool's share accounting
        assertEq(IERC20(token).balanceOf(address(pad)), 0);
        assertEq(antc.balanceOf(address(pad)), 0);
    }

    function test_noTradingOnCurveAfterGraduation() public {
        address token = _launch(alice);
        _sellOut(token);
        vm.prank(bob);
        vm.expectRevert(AntcLaunchpad.AlreadyGraduated.selector);
        pad.buy(token, 1 ether, 0, block.timestamp);
        uint256 t = IERC20(token).balanceOf(carol);
        vm.startPrank(carol);
        IERC20(token).approve(address(pad), t);
        vm.expectRevert(AntcLaunchpad.AlreadyGraduated.selector);
        pad.sell(token, t, 0, block.timestamp);
        // and the token now moves freely, including into the pool
        IERC20(token).transfer(LaunchToken(token).pair(), 1 ether);
        vm.stopPrank();
    }

    function test_donationToPairCannotBlockGraduation() public {
        address token = _launch(alice);
        address pair = LaunchToken(token).pair();
        vm.startPrank(bob);
        antc.transfer(pair, 1_000 ether);
        IPair(pair).sync();
        vm.stopPrank();
        _sellOut(token);
        (, , , , , bool grad) = _launchView(token);
        assertTrue(grad);
        assertGt(IPair(pair).balanceOf(DEAD), 0);
    }

    function test_pairCreatedByOthersFirstStillWorks() public {
        // someone predicts the token address and creates the pair before launch
        address predicted = vm.computeCreateAddress(address(pad), vm.getNonce(address(pad)));
        factory.createPair(predicted, address(antc));
        address token = _launch(alice);
        assertEq(token, predicted);
        _sellOut(token);
        (, , , , , bool grad) = _launchView(token);
        assertTrue(grad);
    }

    // ------------------------------------------------------------ owner limits

    function test_ownerParamBounds() public {
        vm.startPrank(owner);
        vm.expectRevert(AntcLaunchpad.BadParam.selector);
        pad.setParams(201, 5000, 0, TARGET, treasury);
        vm.expectRevert(AntcLaunchpad.BadParam.selector);
        pad.setParams(100, 10_001, 0, TARGET, treasury);
        vm.expectRevert(AntcLaunchpad.BadParam.selector);
        pad.setParams(100, 5000, 0, TARGET, address(0));
        vm.stopPrank();
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, bob));
        pad.setParams(100, 5000, 0, TARGET, treasury);
    }

    function test_newTargetOnlyAffectsNewLaunches() public {
        address a = _launch(alice);
        vm.prank(owner);
        pad.setParams(100, 5000, 0, TARGET * 2, treasury);
        address b = _launch(alice);
        (, , , , , , uint256 ta, ,) = pad.launches(a);
        (, , , , , , uint256 tb, ,) = pad.launches(b);
        assertEq(ta, TARGET);
        assertEq(tb, TARGET * 2);
    }

    // ------------------------------------------------------------ fuzz

    /// The pad always holds exactly the $ANTC it owes to live curves, whatever the trades.
    function testFuzz_solvency(uint256 seed, uint8 steps) public {
        address token = _launch(alice);
        address[3] memory users = [alice, bob, carol];
        uint256 n = bound(steps, 1, 40);
        for (uint256 i; i < n; i++) {
            seed = uint256(keccak256(abi.encode(seed, i)));
            address u = users[seed % 3];
            (, , , , , bool grad) = _launchView(token);
            if (grad) break;
            if ((seed >> 8) % 3 != 0) {
                _buy(u, token, bound(seed >> 16, 1 ether, 60_000 ether));
            } else {
                uint256 bal = IERC20(token).balanceOf(u);
                if (bal == 0) continue;
                uint256 amt = bound(seed >> 16, 1, bal);
                if (pad.quoteSell(token, amt) == 0) continue;
                _sell(u, token, amt);
            }
            (, , uint256 realQ, uint256 sold, , bool g) = _launchView(token);
            if (!g) {
                assertEq(antc.balanceOf(address(pad)), realQ, "pad holds exactly what it owes");
                assertEq(IERC20(token).balanceOf(address(pad)), 1_000_000_000 ether - sold);
            }
        }
    }

    /// Buying and selling back right away never makes money.
    function testFuzz_noFreeProfit(uint256 pre, uint256 q) public {
        address token = _launch(alice);
        pre = bound(pre, 0, 200_000 ether);
        if (pre > 0) _buy(carol, token, pre);
        (, , , , , bool grad) = _launchView(token);
        vm.assume(!grad);
        q = bound(q, 1 ether, 100_000 ether);
        uint256 out = _buy(bob, token, q);
        (, , , , , grad) = _launchView(token);
        vm.assume(!grad);
        uint256 back = _sell(bob, token, out);
        assertLt(back, q);
    }

    /// Selling everything that was bought always succeeds and the curve returns to its start.
    function testFuzz_everyoneCanExit(uint256 a, uint256 b) public {
        address token = _launch(alice);
        a = bound(a, 1 ether, 120_000 ether);
        b = bound(b, 1 ether, 120_000 ether);
        uint256 ta = _buy(bob, token, a);
        uint256 tb = _buy(carol, token, b);
        _sell(bob, token, ta);
        _sell(carol, token, tb);
        (, , uint256 realQ, uint256 sold, , ) = _launchView(token);
        assertEq(sold, 0);
        assertEq(antc.balanceOf(address(pad)), realQ);
    }
}
