pragma solidity ^0.8.22;

import {Test, console2} from "forge-std/Test.sol";

import "@openzeppelin/contracts/interfaces/IERC20Metadata.sol";

import "../src/ForestCommon.sol";
import {ForestRegistry} from "../src/ForestRegistry.sol";
import {ForestSlasher} from "../src/ForestSlasher.sol";
import {IForestProtocol} from "../src/interfaces/IForestProtocol.sol";
import "../src/interfaces/IForestToken.sol";

import {MockedUsdcToken} from "../src/MockedUsdcToken.sol";
import {ForestToken} from "../src/ForestToken.sol";

contract ForestSlasherTest is Test {
    ForestRegistry public registry;
    ForestSlasher public slasher;
    IERC20Metadata public iUsdcToken;
    IForestToken public iForestToken;

    address public p3Addr = address(10);
    address public p1Addr = address(1);
    address public p1BillAddr = address(2);
    address public p1OperatorAddr = address(3);
    address public p2Addr = address(4);
    address public p2BillAddr = address(5);
    address public p2OperatorAddr = address(6);
    address public user1 = address(7);
    address public user2 = address(8);
    address public user3 = address(9);
    address public v1Addr = address(12);
    address public v1BillAddr = address(13);
    address public v1OperatorAddr = address(14);
    address public v2Addr = address(15);
    address public v2BillAddr = address(16);
    address public v2OperatorAddr = address(17);
    address public pto1Addr = address(18);
    address public pto2Addr = address(19);
    string public providerDetailsLink = "https://provider.com";
    string public ptDetailsLink = "https://product.com";
    string public offerDetailsLink = "https://inventory.com";

    // Protocol Sample Params
    uint public PARAM_REVENUE_SHARE = 1000; //10.00%
    uint public PARAM_MAX_PTS_NUM = 2;
    uint public PARAM_ACTOR_REG_FEE = 1 ether;
    uint public PARAM_PT_REG_FEE = 10 ether;
    uint public PARAM_ACTOR_IN_PT_REG_FEE = 2 ether;
    uint public PARAM_OFFER_IN_PT_REG_FEE = 3 ether;
    address public PARAM_TREASURY_ADDR = address(11);
    uint public PARAM_BURN_RATIO = 2000; // 20.00%

    // PT Sample Params
    uint public constant MAX_VALS_NUM = 2;
    uint public constant MAX_PROVS_NUM = 2;
    uint public constant MIN_COLLATERAL = 10 ether;
    uint public constant VAL_REG_FEE = 1 ether;
    uint public constant PROV_REG_FEE = 2 ether;
    uint public constant OFFER_REG_FEE = 3 ether;
    uint public constant TERM_UPDATE_DELAY = 400;
    uint public constant PROV_SHARE = 4500;
    uint public constant VAL_SHARE = 4500;
    uint public constant PT_OWNER_SHARE = 1000;
    uint public constant PERFORMANCE_WEIGHT = 7000;
    uint public constant PRICE_WEIGHT = 1000;
    uint public constant PTP_WEIGHT = 1000;
    uint public constant POPULARITY_WEIGHT = 1000;
    string public constant DETAILS_LINK = "https://pt123.com";
    string public testDetailsLink = "https://test.com";
    // Actor Sample Deploy Params
    uint public constant INITIAL_COLLATERAL = 20 ether;
    uint public constant INITIAL_DEPOSIT = 3 * 2 * 31 * 24 * 60 * 60;

    // Sample depoyment
    IForestProtocol pt1;
    IForestProtocol pt2;

    struct ProviderScore {
        uint24 provId; // we are using IDs to save on space, 24 bits vs 20*8 bits
        uint256 score;
        uint32 agreementId; 
    }

    enum CommitmentStatus {
        COMMITED,
        REVEALED
    }

    function setUp() public {
        MockedUsdcToken usdcContract = new MockedUsdcToken(address(this));
        iUsdcToken = IERC20Metadata(address(usdcContract));
        ForestToken forestContract = new ForestToken();
        iForestToken = IForestToken(address(forestContract));
        
        slasher = new ForestSlasher();
        registry = new ForestRegistry(address(slasher), address(iUsdcToken), address(iForestToken), PARAM_REVENUE_SHARE, PARAM_MAX_PTS_NUM, PARAM_ACTOR_REG_FEE, PARAM_PT_REG_FEE, PARAM_ACTOR_IN_PT_REG_FEE, PARAM_OFFER_IN_PT_REG_FEE, PARAM_TREASURY_ADDR, PARAM_BURN_RATIO);
        slasher.setRegistryAndForestAddr(address(registry));
        iForestToken.setRegistryAndSlasherAddr(address(registry));

        // deploy sample PTs
        fundAccountWithToken(pto1Addr, 1100);
        fundAccountWithToken(pto2Addr, 1100);
        
        vm.startPrank(pto1Addr);
        registry.registerActor(ForestCommon.ActorType.PT_OWNER, address(0), address(0), providerDetailsLink); // actor id 0
        address ptAddr = registry.createProtocol(MAX_VALS_NUM, MAX_PROVS_NUM, MIN_COLLATERAL, VAL_REG_FEE, PROV_REG_FEE, OFFER_REG_FEE, TERM_UPDATE_DELAY, PROV_SHARE, VAL_SHARE, PT_OWNER_SHARE, DETAILS_LINK);
        pt1 = IForestProtocol(ptAddr);

        vm.startPrank(pto2Addr);
        registry.registerActor(ForestCommon.ActorType.PT_OWNER, address(0), address(0), providerDetailsLink);  // actor id 1
        ptAddr = registry.createProtocol(MAX_VALS_NUM, MAX_PROVS_NUM, MIN_COLLATERAL, VAL_REG_FEE, PROV_REG_FEE, OFFER_REG_FEE, TERM_UPDATE_DELAY, PROV_SHARE, VAL_SHARE, PT_OWNER_SHARE, DETAILS_LINK);
        pt2 = IForestProtocol(ptAddr);

        // deploy sample providers and offers
        vm.startPrank(address(this));
        fundAccountWithToken(p1Addr, 1100);
        fundAccountWithToken(p2Addr, 1100);

        vm.startPrank(p1Addr);
        registry.registerActor(ForestCommon.ActorType.PROVIDER, address(0), address(0), providerDetailsLink);  // actor id 2
        pt1.registerActor(ForestCommon.ActorType.PROVIDER, INITIAL_COLLATERAL);
        pt2.registerActor(ForestCommon.ActorType.PROVIDER, INITIAL_COLLATERAL);
        pt1.registerOffer(p1Addr, 1, 3, offerDetailsLink); // offer id 0
        pt1.registerOffer(p1Addr, 2, 3, offerDetailsLink); // offer id 1
        pt2.registerOffer(p1Addr, 2, 3, offerDetailsLink); // offer id 0

        vm.startPrank(p2Addr);
        registry.registerActor(ForestCommon.ActorType.PROVIDER, address(0), address(0), providerDetailsLink);  // actor id 3
        pt1.registerActor(ForestCommon.ActorType.PROVIDER, INITIAL_COLLATERAL);
        pt2.registerActor(ForestCommon.ActorType.PROVIDER, INITIAL_COLLATERAL);
        pt1.registerOffer(p2Addr, 1, 3, offerDetailsLink); // offer id 2
        pt1.registerOffer(p2Addr, 2, 3, offerDetailsLink); // offer id 3
        pt2.registerOffer(p2Addr, 2, 3, offerDetailsLink); // offer id 1

        // deply sample agreements
        vm.startPrank(address(this));
        fundAccountWithToken(v1Addr, 11000);
        fundAccountWithToken(v2Addr, 11000);

        vm.startPrank(v1Addr);
        iUsdcToken.approve(address(pt1), 10*INITIAL_DEPOSIT);
        iUsdcToken.approve(address(pt2), 10*INITIAL_DEPOSIT);
        registry.registerActor(ForestCommon.ActorType.VALIDATOR, address(0), address(0), providerDetailsLink);  // actor id 4
        pt1.registerActor(ForestCommon.ActorType.VALIDATOR, INITIAL_COLLATERAL);
        pt2.registerActor(ForestCommon.ActorType.VALIDATOR, INITIAL_COLLATERAL);
        pt1.enterAgreement(0, INITIAL_DEPOSIT); // agreement id 0
        pt1.enterAgreement(1, INITIAL_DEPOSIT); // agreement id 1
        pt1.enterAgreement(2, INITIAL_DEPOSIT); // agreement id 2
        pt1.enterAgreement(3, INITIAL_DEPOSIT); // agreement id 3
        pt2.enterAgreement(0, INITIAL_DEPOSIT); // agreement id 0
        pt2.enterAgreement(1, INITIAL_DEPOSIT); // agreement id 1

        vm.startPrank(v2Addr);
        iUsdcToken.approve(address(pt1), 10*INITIAL_DEPOSIT);
        iUsdcToken.approve(address(pt2), 10*INITIAL_DEPOSIT);
        registry.registerActor(ForestCommon.ActorType.VALIDATOR, address(0), address(0), providerDetailsLink);  // actor id 5
        pt1.registerActor(ForestCommon.ActorType.VALIDATOR, INITIAL_COLLATERAL);
        pt2.registerActor(ForestCommon.ActorType.VALIDATOR, INITIAL_COLLATERAL);
        pt1.enterAgreement(0, INITIAL_DEPOSIT); // agreement id 4
        pt1.enterAgreement(1, INITIAL_DEPOSIT); // agreement id 5
        pt1.enterAgreement(2, INITIAL_DEPOSIT); // agreement id 6
        pt1.enterAgreement(3, INITIAL_DEPOSIT); // agreement id 7
        pt2.enterAgreement(0, INITIAL_DEPOSIT); // agreement id 2
        pt2.enterAgreement(1, INITIAL_DEPOSIT); // agreement id 3
    }

    function fundAccountWithToken(address _account, uint256 _amount) public {
        iUsdcToken.transfer(_account, _amount * 10 ** iUsdcToken.decimals());
        iForestToken.transfer(_account, _amount * 10 ** iForestToken.decimals());

        vm.startPrank(_account);
        iUsdcToken.approve(
            address(registry),
            _amount * 10 ** iUsdcToken.decimals()
        );
        iForestToken.approve(
            address(slasher),
            _amount * 10 ** iForestToken.decimals()
        );
        iForestToken.approve(
            address(registry),
            _amount * 10 ** iForestToken.decimals()
        );
        vm.stopPrank();
    }

    function testCommit() public {
        bytes32 pt1Val1Hash = keccak256("testResultsCidpt1v1");
        bytes32 pt2Val1Hash = keccak256("testResultsCidpt2v1");
        bytes32 pt1Val2Hash = keccak256("testResultsCidpt1v2");
        bytes32 pt2Val2Hash = keccak256("testResultsCidpt2v2");

        // address that is not a validator tries to commit
        vm.startPrank(user1);
        vm.expectPartialRevert(ForestCommon.OnlyOwnerOrOperatorAllowed.selector);
        slasher.commit(pt1Val1Hash, v1Addr, address(pt1), testDetailsLink);
        vm.expectPartialRevert(ForestCommon.OnlyOwnerOrOperatorAllowed.selector);
        slasher.commit(pt1Val1Hash, user1, address(pt1), testDetailsLink);
        
        // validator 1 commits scores for both pt 1 and 2
        vm.startPrank(v1Addr);
        slasher.commit(pt1Val1Hash, v1Addr, address(pt1), testDetailsLink);
        slasher.commit(pt2Val1Hash, v1Addr, address(pt2), testDetailsLink);

        assertEq(slasher.getEpochScoresGranular(address(pt1)).length, 1);
        assertEq(slasher.getEpochScoresGranular(address(pt2)).length, 1);
        assertEq(slasher.getHashToIndex(pt1Val1Hash), 0);
        assertEq(slasher.getHashToIndex(pt2Val1Hash), 0);

        // validator 2 does the same
        vm.startPrank(v2Addr);
        slasher.commit(pt1Val2Hash, v2Addr, address(pt1), testDetailsLink);
        slasher.commit(pt2Val2Hash, v2Addr, address(pt2), testDetailsLink);

        assertEq(slasher.getEpochScoresGranular(address(pt1)).length, 2);
        assertEq(slasher.getEpochScoresGranular(address(pt2)).length, 2);
        assertEq(slasher.getHashToIndex(pt1Val2Hash), 1);
        assertEq(slasher.getHashToIndex(pt2Val2Hash), 1);

        // validator 2 attempts to commit again what he has already commited
        vm.expectPartialRevert(ForestCommon.CommitmentAlreadySubmitted.selector);
        slasher.commit(pt1Val2Hash, v2Addr, address(pt1), testDetailsLink);

        // validator 2 attempts to commit scores to an not registered pt
        vm.expectPartialRevert(ForestCommon.ObjectNotActive.selector);
        slasher.commit(keccak256("testResultsCidpt3"), v2Addr, address(123), testDetailsLink);

        // user 1 who isn't a validator attempts to commit scores to a pt
        vm.startPrank(user1);
        vm.expectPartialRevert(ForestCommon.OnlyOwnerOrOperatorAllowed.selector);
        slasher.commit(keccak256("testResultsCidpt1.12"), user1, address(pt1), testDetailsLink);
    }

    function testReveal() public {  
        // build score arrays for validator 1
        ForestSlasher.ProviderScore[] memory provScorespt1Val1 = new ForestSlasher.ProviderScore[](4);
        ForestSlasher.ProviderScore[] memory provScorespt2Val1 = new ForestSlasher.ProviderScore[](2);
        provScorespt1Val1[0] = ForestSlasher.ProviderScore(2, 2, 0);
        provScorespt1Val1[1] = ForestSlasher.ProviderScore(2, 3, 1);
        provScorespt1Val1[2] = ForestSlasher.ProviderScore(3, 1, 2);
        provScorespt1Val1[3] = ForestSlasher.ProviderScore(3, 1, 3);
        provScorespt2Val1[0] = ForestSlasher.ProviderScore(2, 1, 0);
        provScorespt2Val1[1] = ForestSlasher.ProviderScore(3, 1, 1);
        bytes32 pt1Val1Hash = slasher.computeHash(provScorespt1Val1);
        bytes32 pt2Val1Hash = slasher.computeHash(provScorespt2Val1);

        // build score arrays for validator 2
        ForestSlasher.ProviderScore[] memory provScorespt1Val2 = new ForestSlasher.ProviderScore[](4);
        ForestSlasher.ProviderScore[] memory provScorespt2Val2 = new ForestSlasher.ProviderScore[](2);
        provScorespt1Val2[0] = ForestSlasher.ProviderScore(2, 4, 4);
        provScorespt1Val2[1] = ForestSlasher.ProviderScore(2, 4, 5);
        provScorespt1Val2[2] = ForestSlasher.ProviderScore(3, 1, 6);
        provScorespt1Val2[3] = ForestSlasher.ProviderScore(3, 1, 7);
        provScorespt2Val2[0] = ForestSlasher.ProviderScore(2, 1, 2);
        provScorespt2Val2[1] = ForestSlasher.ProviderScore(3, 1, 3);
        bytes32 pt1Val2Hash = slasher.computeHash(provScorespt1Val2);
        bytes32 pt2Val2Hash = slasher.computeHash(provScorespt2Val2);

        // validator 1 commits scores for both pt 1 and 2
        vm.startPrank(v1Addr);
        slasher.commit(pt1Val1Hash, v1Addr, address(pt1), testDetailsLink);
        slasher.commit(pt2Val1Hash, v1Addr, address(pt2), testDetailsLink);
        // validator 2 does the same
        vm.startPrank(v2Addr);
        slasher.commit(pt1Val2Hash, v2Addr, address(pt1), testDetailsLink);
        slasher.commit(pt2Val2Hash, v2Addr, address(pt2), testDetailsLink);
        // for a later test
        slasher.commit(keccak256("randomHash"), v2Addr, address(pt1), testDetailsLink);

        // validator 1 tryies to reveal to early
        vm.startPrank(v1Addr);
        vm.expectPartialRevert(ForestCommon.InvalidState.selector);
        slasher.reveal(pt1Val1Hash, v1Addr, address(pt1), provScorespt1Val1);
        
        // now waits and reveals when the window is open
        vm.roll(slasher.getCurrentEpochEndBlockNum() + slasher.REVEAL_WINDOW()); // TODO: do an in-depth count by 1 check on windows to reveal and mint
        slasher.reveal(pt1Val1Hash, v1Addr, address(pt1), provScorespt1Val1);
        slasher.reveal(pt2Val1Hash, v1Addr, address(pt2), provScorespt2Val1);

        // address that is not a validator tries to reveal not his own data
        vm.startPrank(user1);
        vm.expectPartialRevert(ForestCommon.OnlyOwnerOrOperatorAllowed.selector);
        slasher.reveal(pt1Val2Hash, v2Addr, address(pt1), provScorespt1Val2);
        vm.expectPartialRevert(ForestCommon.Unauthorized.selector);
        slasher.reveal(pt1Val2Hash, user1, address(pt1), provScorespt1Val2);

        // validator 2 tries to reveal his results
        vm.startPrank(v2Addr);
        slasher.reveal(pt1Val2Hash, v2Addr, address(pt1), provScorespt1Val2);
        slasher.reveal(pt2Val2Hash, v2Addr, address(pt2), provScorespt2Val2);

        assertEq(slasher.getEpochScoresGranular(address(pt1)).length, 3);
        assertEq(slasher.getEpochScoresGranular(address(pt2)).length, 2);
        assertEq(slasher.getEpochScoresGranular(address(pt1))[0].provScores.length, 4);
        assertEq(slasher.getEpochScoresGranular(address(pt1))[1].provScores.length, 4);
        assertEq(slasher.getEpochScoresGranular(address(pt2))[0].provScores.length, 2);
        assertEq(slasher.getEpochScoresGranular(address(pt2))[1].provScores.length, 2);

        // validator 2 tries to reveal what was already revealed
        vm.expectPartialRevert(ForestCommon.InvalidState.selector);
        slasher.reveal(pt1Val2Hash, v2Addr, address(pt1), provScorespt1Val2);

        // validator 2 attemps to commit data and the reveal with provScores that do not match the commitment hash
        vm.expectPartialRevert(ForestCommon.InvalidState.selector);
        slasher.reveal(keccak256("randomHash"), v2Addr, address(pt1), provScorespt1Val2);
    }

    function testCloseEpoch() public {
        testReveal();
        uint256 currentEpoch = slasher.getCurrentEpochEndBlockNum();
        vm.roll(currentEpoch + slasher.REVEAL_WINDOW() + 1); 
        uint256 closedEpoch = slasher.closeEpoch();

        assertEq(closedEpoch, currentEpoch);

        ForestSlasher.EpochScoreAggregate[] memory aggregates = slasher.getEpochScoresAggregate(currentEpoch);
        assertEq(slasher.getCurrentEpochEndBlockNum(), currentEpoch + slasher.EPOCH_LENGTH());
        assertEq(aggregates.length, 2);
        assertEq(aggregates[0].provRanks.length, 2); 
        assertEq(aggregates[0].valRanks.length, 2);
        assertEq(aggregates[1].provRanks.length, 2);
        assertEq(aggregates[1].valRanks.length, 2);
        assertEq(aggregates[0].revenueAtEpochClose, 12);
        assertEq(aggregates[1].revenueAtEpochClose, 8);
        // TODO: add more advanced test of aggregate scores
    }

    function testWithdrawActorCollateral() public {
        // validator 1 tries to withdraw half of his collateral
        vm.startPrank(v1Addr);
        slasher.withdrawActorCollateral(address(pt1), ForestCommon.ActorType.VALIDATOR, INITIAL_COLLATERAL / 2);
        // try to withdraw more collateral, should be too much because what's left won't meet the min collateral of the PT
        vm.expectPartialRevert(ForestCommon.InsufficientAmount.selector);
        slasher.withdrawActorCollateral(address(pt1), ForestCommon.ActorType.VALIDATOR, INITIAL_COLLATERAL / 3);

        // same checks for provider 1
        vm.startPrank(p1Addr);
        slasher.withdrawActorCollateral(address(pt1), ForestCommon.ActorType.PROVIDER, INITIAL_COLLATERAL / 2);
        // try to withdraw more collateral, should be too much because what's left won't meet the min collateral of the PT
        vm.expectPartialRevert(ForestCommon.InsufficientAmount.selector);
        slasher.withdrawActorCollateral(address(pt1), ForestCommon.ActorType.PROVIDER, INITIAL_COLLATERAL / 3); 

        // address that hasn't deposited collateral tries to withdraw
        vm.startPrank(user1);
        vm.expectPartialRevert(ForestCommon.OnlyOwnerAllowed.selector);
        slasher.withdrawActorCollateral(address(pt1), ForestCommon.ActorType.PROVIDER, INITIAL_COLLATERAL / 2);
    }



//     // function testWithdrawProviderCollateralByAdmin() public {
//     //         uint256 depositedFunds = 100;
//     //         fundAccountWithToken(p1Addr, depositedFunds);
//     //         vm.startPrank(p1Addr);
//     //         registry.registerProvider(
//     //             address(0),
//     //             address(0),
//     //             100,
//     //             providerDetailsLink
//     //         );
//     //         vm.stopPrank();
//     //         vm.startPrank(address(this));
//     //         uint256 contractBalanceBefore = iUsdcToken.balanceOf(
//     //             address(registry)
//     //         );
//     //         registry.withdrawProviderCollateral(p1Addr, 50);
//     //         assertEq(
//     //             iUsdcToken.balanceOf(address(registry)),
//     //             contractBalanceBefore - 50
//     //         );
//     //         vm.startPrank(p2Addr);
//     //         vm.expectRevert();
//     //         registry.withdrawProviderCollateral(p1Addr, 50);
//     //     }

//     //     function testTopUpValidatorCollateral() public {
//     //         uint256 depositedFunds = 100;
//     //         fundAccountWithToken(p1Addr, depositedFunds);
//     //         vm.startPrank(p1Addr);

//     //         testRegisterValidatorWithOneProductWithCollateral();
//     //         uint256 validatorCollateralBalanceOfBefore = registry
//     //             .getActorCollateralBalanceOf(p1Addr);
//     //         registry.topUpValidatorCollateral(depositedFunds);
//     //         uint256 validatorCollateralBalanceOfAfter = registry
//     //             .getActorCollateralBalanceOf(p1Addr);
//     //         assertEq(
//     //             validatorCollateralBalanceOfAfter,
//     //             validatorCollateralBalanceOfBefore + depositedFunds
//     //         );
//     //     }

//     //     function testRevertTopUpValidatorCollateral() public {
//     //         fundAccountWithToken(p1Addr, 100);
//     //         vm.startPrank(p1Addr);
//     //         vm.expectRevert();
//     //         registry.topUpValidatorCollateral(100);
//     //         vm.expectRevert();
//     //         registry.topUpValidatorCollateral(0);
//     //     }

//     //     function testWithdrawValidatorCollateralByAdmin() public {
//     //         uint256 depositedFunds = 100;
//     //         fundAccountWithToken(p1Addr, depositedFunds);
//     //         vm.startPrank(p1Addr);
//     //         testRegisterValidatorWithOneProductNoCollateral();
//     //         registry.topUpValidatorCollateral(50);
//     //         vm.stopPrank();
//     //         vm.startPrank(address(this));
//     //         uint256 contractBalanceBefore = iUsdcToken.balanceOf(
//     //             address(registry)
//     //         );
//     //         registry.withdrawValidatorCollateral(p1Addr, 10);
//     //         assertEq(
//     //             iUsdcToken.balanceOf(address(registry)),
//     //             contractBalanceBefore - 10
//     //         );
//     //         vm.startPrank(p2Addr);
//     //         vm.expectRevert();
//     //         registry.withdrawValidatorCollateral(p1Addr, 10);
//     //     }
// }
}