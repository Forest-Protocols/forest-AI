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


contract ForestProtocolTest is Test {
    ForestRegistry public registry;
    ForestSlasher public slasher;
    IERC20Metadata public iUsdcToken;
    IForestToken public iForestToken;

    address public treasuryAddr = address(11);
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
    string public providerDetailsLink = "https://provider.com";
    string public ptDetailsLink = "https://product.com";
    string public offerDetailsLink = "https://inventory.com";

    uint256 public p2AddrInitialBalance = 220;
    uint256 public user1InitialBalance = 15;

    // Protocol Sample Params
    uint public PARAM_REVENUE_SHARE = 1000; //10.00%
    uint public PARAM_MAX_ptS_NUM = 2;
    uint public PARAM_ACTOR_REG_FEE = 1 ether;
    uint public PARAM_pt_REG_FEE = 10 ether;
    uint public PARAM_ACTOR_IN_pt_REG_FEE = 2 ether;
    uint public PARAM_OFFER_IN_pt_REG_FEE = 3 ether;
    address public PARAM_TREASURY_ADDR = treasuryAddr;
    uint public PARAM_BURN_RATIO = 2000; // 20.00%

    // pt Sample Params
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
    string public constant DETAILS_LINK = "https://pc123.com";

    uint public constant BLOCK_TIME = 2;

    // Actor Sample Deploy Params
    uint public constant INITIAL_COLLATERAL = 10 ether;

    function setUp() public {
        
        MockedUsdcToken usdcContract = new MockedUsdcToken(address(this));
        iUsdcToken = IERC20Metadata(address(usdcContract));
        ForestToken forestContract = new ForestToken();
        iForestToken = IForestToken(address(forestContract));
        
        // TODO: update the creation process not to be dependent on the updateRegistryAddr function call and correct order
        slasher = new ForestSlasher();
        registry = new ForestRegistry(address(slasher), address(iUsdcToken), address(iForestToken), PARAM_REVENUE_SHARE, PARAM_MAX_ptS_NUM, PARAM_ACTOR_REG_FEE, PARAM_pt_REG_FEE, PARAM_ACTOR_IN_pt_REG_FEE, PARAM_OFFER_IN_pt_REG_FEE, PARAM_TREASURY_ADDR, PARAM_BURN_RATIO);
        slasher.setRegistryAndForestAddr(address(registry));
        iForestToken.setRegistryAndSlasherAddr(address(registry));
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

    function testTryTocallInitializeAgain() public {
        IForestProtocol pt = deploySamplePtWithP1Addr();
        vm.expectRevert();
        pt.initialize(address(666));
    }

    /***********************************|
    |   In PT:                          |
    |   Provider/Validator Registration |
    |__________________________________*/

    function testRegisterInPtOneProviderAndOneValidator() public {
        fundAccountWithToken(p1Addr, 11);
        fundAccountWithToken(p2Addr, 11);
        fundAccountWithToken(p3Addr, 11);

        // register pt owner in the protocol and spin up a new PT
        vm.startPrank(p1Addr);
        registry.registerActor(ForestCommon.ActorType.PT_OWNER, address(0), address(0), providerDetailsLink);
        
        address ptAddr = registry.createProtocol(1, 2, 1, 1, 2, 3, 10, 4000, 4000, 2000, ptDetailsLink);
        IForestProtocol pt = IForestProtocol(ptAddr);

        // register a new provider in the protocol and later in the new PT
        vm.startPrank(p2Addr);
        registry.registerActor(ForestCommon.ActorType.PROVIDER, address(0), address(0), providerDetailsLink);
        pt.registerActor(ForestCommon.ActorType.PROVIDER, 10);

        // run checks in the pt
        uint treasuryBalanceAfter1stOperation = iForestToken.balanceOf(address(registry.getTreasuryAddr()));
        assertEq(pt.getActiveAgreementsValue(), 0);
        assertEq(pt.getAgreementsCount(), 0);
        assertEq(pt.getAllProviderIds().length, 1);
        assertEq(pt.getAllValidatorIds().length, 0);
        assertEq(slasher.getCollateralBalanceOf(ptAddr, p2Addr), 10);
        assertEq(pt.isRegisteredActiveActor(ForestCommon.ActorType.PROVIDER, p2Addr), true);
        assertGt(treasuryBalanceAfter1stOperation, 0);

        // register a new validator in the protocol and later in the new PT
        vm.startPrank(p3Addr);
        registry.registerActor(ForestCommon.ActorType.VALIDATOR, address(0), address(0), providerDetailsLink);
        pt.registerActor(ForestCommon.ActorType.VALIDATOR, 11);
        
        // run checks in the pt
        assertEq(pt.getActiveAgreementsValue(), 0);
        assertEq(pt.getAgreementsCount(), 0);
        assertEq(pt.getAllProviderIds().length, 1);
        assertEq(pt.getAllValidatorIds().length, 1);
        assertEq(slasher.getCollateralBalanceOf(ptAddr,p2Addr), 10);
        assertEq(slasher.getCollateralBalanceOf(ptAddr,p3Addr), 11);
        assertEq(pt.isRegisteredActiveActor(ForestCommon.ActorType.VALIDATOR, p3Addr), true);
        assertGt(iForestToken.balanceOf(address(registry.getTreasuryAddr())), treasuryBalanceAfter1stOperation);
    }

    function testRegisterInPtNotRegisteredActor() public {
        fundAccountWithToken(p1Addr, 11);
        fundAccountWithToken(p2Addr, 11);

        // register pt owner in the protocol and spin up a new PT
        vm.startPrank(p1Addr);
        registry.registerActor(ForestCommon.ActorType.PT_OWNER, address(0), address(0), providerDetailsLink);
        
        address ptAddr = registry.createProtocol(1, 2, 1, 1, 2, 3, 10, 4000, 4000, 2000, ptDetailsLink);
        IForestProtocol pt = IForestProtocol(ptAddr);

        // register a new provider in the protocol and later in the new PT
        vm.startPrank(p2Addr);
        vm.expectRevert(IForestProtocol.ActorNotRegistered.selector);
        pt.registerActor(ForestCommon.ActorType.PROVIDER, 10);
    }

    function testRegisterInPtAlreadyRegisteredActor() public {
        fundAccountWithToken(p1Addr, 11);
        fundAccountWithToken(p2Addr, 11);

        // register pt owner in the protocol and spin up a new PT
        vm.startPrank(p1Addr);
        registry.registerActor(ForestCommon.ActorType.PT_OWNER, address(0), address(0), providerDetailsLink);
        
        address ptAddr = registry.createProtocol(4, 2, 1, 1, 2, 3, 10, 4000, 4000, 2000, ptDetailsLink);
        IForestProtocol pt = IForestProtocol(ptAddr);

        // register a new provider in the protocol and later in the new PT
        vm.startPrank(p2Addr);
        registry.registerActor(ForestCommon.ActorType.VALIDATOR, address(0), address(0), providerDetailsLink);
        pt.registerActor(ForestCommon.ActorType.VALIDATOR, 10);
        vm.expectRevert(IForestProtocol.ActorAlreadyRegistered.selector);
        pt.registerActor(ForestCommon.ActorType.VALIDATOR, 10);
    }

    function testRegisterInPtValidatorAsProvider() public {
        fundAccountWithToken(p1Addr, 11);
        fundAccountWithToken(p2Addr, 11);

        // register pt owner in the protocol and spin up a new PT
        vm.startPrank(p1Addr);
        registry.registerActor(ForestCommon.ActorType.PT_OWNER, address(0), address(0), providerDetailsLink);
        
        address ptAddr = registry.createProtocol(1, 2, 1, 1, 2, 3, 10, 4000, 4000, 2000, ptDetailsLink);
        IForestProtocol pt = IForestProtocol(ptAddr);

        // register a new provider in the protocol and later in the new PT
        vm.startPrank(p2Addr);
        registry.registerActor(ForestCommon.ActorType.VALIDATOR, address(0), address(0), providerDetailsLink);
        vm.expectRevert(IForestProtocol.ActorNotRegistered.selector);
        pt.registerActor(ForestCommon.ActorType.PROVIDER, 10);
    }

    function testRegisterInPtValidatorWithTooLowCollateral() public {
        fundAccountWithToken(p1Addr, 11);
        fundAccountWithToken(p2Addr, 11);

        // register pt owner in the protocol and spin up a new PT
        vm.startPrank(p1Addr);
        registry.registerActor(ForestCommon.ActorType.PT_OWNER, address(0), address(0), providerDetailsLink);
        
        address ptAddr = registry.createProtocol(1, 2, 100, 1, 2, 3, 10, 4000, 4000, 2000, ptDetailsLink);
        IForestProtocol pt = IForestProtocol(ptAddr);

        // register a new provider in the protocol and later in the new PT
        vm.startPrank(p2Addr);
        registry.registerActor(ForestCommon.ActorType.VALIDATOR, address(0), address(0), providerDetailsLink);
        vm.expectRevert(IForestProtocol.InsufficientAmount.selector);
        pt.registerActor(ForestCommon.ActorType.VALIDATOR, 10);
    }

    function deploySamplePtWithP1Addr() public returns (IForestProtocol) {
        vm.startPrank(address(this));
        fundAccountWithToken(p1Addr, 11);
        vm.startPrank(p1Addr);
        registry.registerActor(ForestCommon.ActorType.PT_OWNER, address(0), address(0), providerDetailsLink);
        
        address ptAddr = registry.createProtocol(MAX_VALS_NUM, MAX_PROVS_NUM, MIN_COLLATERAL, VAL_REG_FEE, PROV_REG_FEE, OFFER_REG_FEE, TERM_UPDATE_DELAY, PROV_SHARE, VAL_SHARE, PT_OWNER_SHARE, DETAILS_LINK);
        IForestProtocol pt = IForestProtocol(ptAddr);
        return pt;
    }

    function deploySampleProviderWithP2Addr(IForestProtocol _pt) public  {
        vm.startPrank(address(this));
        fundAccountWithToken(p2Addr, p2AddrInitialBalance);
        vm.startPrank(p2Addr);
        registry.registerActor(ForestCommon.ActorType.PROVIDER, p2OperatorAddr, p2BillAddr, providerDetailsLink);
        _pt.registerActor(ForestCommon.ActorType.PROVIDER, INITIAL_COLLATERAL);
    }

    function deploySampleProviderAndOfferWithP2Addr(IForestProtocol _pt) public  {
        deploySampleProviderWithP2Addr(_pt);
        vm.startPrank(p2Addr);
        _pt.registerOffer(p2Addr, 1, 2, offerDetailsLink);
    }

    function testRegisterOneInventory() public {
        IForestProtocol pt = deploySamplePtWithP1Addr();
        deploySampleProviderWithP2Addr(pt);
        
        uint treasuryBalanceBefore = iForestToken.balanceOf(address(treasuryAddr));
        vm.startPrank(p2Addr);
        uint32 offerId = pt.registerOffer(p2Addr, 1, 100, offerDetailsLink);
        ForestCommon.Offer memory offer = pt.getOffer(offerId); 

        assertEq(offer.id, offerId);
        assertEq(offer.ownerAddr, p2Addr);
        assertEq(offer.fee, 1);
        assertEq(offer.stockAmount, 100);
        assertEq(offer.activeAgreements, 0);

        assertEq(pt.getAllProviderIds().length, 1);
        assertEq(pt.getOffersCount(), 1);
        assertEq(pt.getAgreementsCount(), 0);
        assertEq(pt.getActiveAgreementsValue(), 0);

        assertEq(registry.getAllPtAddresses().length, 1);
        assertEq(registry.getAllProviders().length, 1);

        (,, uint fee) = pt.getFees();
        assertEq(iForestToken.balanceOf(address(treasuryAddr)), treasuryBalanceBefore + (10000-PARAM_BURN_RATIO)*(fee + registry.getOfferInPtRegFee()) / 10000);
    }

    function testRegisterOneInventoryFromUnregisteredProvider() public {
        IForestProtocol pt = deploySamplePtWithP1Addr();
        
        vm.startPrank(p2Addr);
        vm.expectRevert();
        uint32 offerId = pt.registerOffer(p2Addr, 1, 100, offerDetailsLink);
    }

    function testRegisterOneInventoryFromProviderRegisteredInProtocolButNotPt() public {
        fundAccountWithToken(p2Addr, 100);
        IForestProtocol pt = deploySamplePtWithP1Addr();
       
        vm.startPrank(p2Addr);
        registry.registerActor(ForestCommon.ActorType.PROVIDER, address(0), address(0), "asd");
        vm.expectRevert();
        uint32 offerId = pt.registerOffer(p2Addr, 1, 100, offerDetailsLink);
    }

    function testRegisterOneInventoryFromValidator() public {
        fundAccountWithToken(p2Addr, 100);
        IForestProtocol pt = deploySamplePtWithP1Addr();
       
        vm.startPrank(p2Addr);
        registry.registerActor(ForestCommon.ActorType.VALIDATOR, address(0), address(0), "asd");
        pt.registerActor(ForestCommon.ActorType.VALIDATOR, 10 ether);
        vm.expectRevert();
        uint32 offerId = pt.registerOffer(p2Addr, 1, 100, offerDetailsLink);
    }

    function testRegisterOneInventoryWithZeroFee() public {
        IForestProtocol pt = deploySamplePtWithP1Addr();
        deploySampleProviderWithP2Addr(pt);
        
        vm.startPrank(p2Addr);
        vm.expectPartialRevert(ForestCommon.InvalidParam.selector);
        uint32 offerId = pt.registerOffer(p2Addr, 0, 100, offerDetailsLink);
    }

    function testRegisterOneInventoryWithZeroStock() public {
        IForestProtocol pt = deploySamplePtWithP1Addr();
        deploySampleProviderWithP2Addr(pt);
        
        vm.startPrank(p2Addr);
        vm.expectPartialRevert(ForestCommon.InvalidParam.selector);
        uint32 offerId = pt.registerOffer(p2Addr, 1, 0, offerDetailsLink);
    }

    function testRegisterOneInventoryWithemptyDetails() public {
        IForestProtocol pt = deploySamplePtWithP1Addr();
        deploySampleProviderWithP2Addr(pt);
        
        vm.startPrank(p2Addr);
        vm.expectPartialRevert(ForestCommon.InvalidParam.selector);
        uint32 offerId = pt.registerOffer(p2Addr, 1, 100, "");
    }

    function testRegisterOneInventoryFromOperatorAddr() public {
        IForestProtocol pt = deploySamplePtWithP1Addr();
        deploySampleProviderWithP2Addr(pt);
        
        vm.startPrank(p2Addr);
        uint32 offerId = pt.registerOffer(p2Addr, 1, 100, offerDetailsLink);

        assertEq(pt.getOffersCount(), 1);
        assertEq(pt.getAgreementsCount(), 0);
        assertEq(pt.getAllProviderIds().length, 1);
    }

    function testRegisterTwoInventoriesSameProviderSameProduct() public {
        IForestProtocol pt = deploySamplePtWithP1Addr();
        deploySampleProviderWithP2Addr(pt);
        
        uint treasuryBalanceBefore = iForestToken.balanceOf(address(treasuryAddr));
        vm.startPrank(p2Addr);
        pt.registerOffer(p2Addr, 1, 10, offerDetailsLink);
        pt.registerOffer(p2Addr, 2, 100, offerDetailsLink);

        assertEq(pt.getAllProviderIds().length, 1);
        assertEq(pt.getOffersCount(), 2);
        assertEq(pt.getAgreementsCount(), 0);
        assertEq(pt.getActiveAgreementsValue(), 0);

        assertEq(registry.getAllPtAddresses().length, 1);
        assertEq(registry.getAllProviders().length, 1);

        (,, uint fee) = pt.getFees();
        assertEq(iForestToken.balanceOf(address(treasuryAddr)), treasuryBalanceBefore + 2*(10000-PARAM_BURN_RATIO)*(fee + registry.getOfferInPtRegFee()) / 10000);
    }

    /***********************************|
    |   In PT:                          |
    |   Entering Agreement             |
    |__________________________________*/

    function testEnterAgreement() public {
        fundAccountWithToken(user1, user1InitialBalance);
        
        IForestProtocol pt = deploySamplePtWithP1Addr();
        deploySampleProviderWithP2Addr(pt);
        
        vm.startPrank(p2Addr);
        uint32 offerId = pt.registerOffer(p2Addr, 1, 100, offerDetailsLink);
        uint256 initialDeposit = 1 * 2 * 31 * 24 * 60 * 60;

        vm.startPrank(user1);
        iUsdcToken.approve(address(pt), initialDeposit);

        uint256 treasuryBalanceBefore = iUsdcToken.balanceOf(address(treasuryAddr));
        uint32 agreementId = pt.enterAgreement(
            offerId,
            initialDeposit
        );

        ForestCommon.Agreement memory agreement = pt.getAgreement(agreementId);

        assertEq(agreement.id, 0);
        assertEq(agreement.offerId, offerId);
        assertEq(agreement.userAddr, user1);
        assertEq(iUsdcToken.balanceOf(user1), user1InitialBalance*10**iUsdcToken.decimals() - initialDeposit);
        assertEq(agreement.balance, initialDeposit - (initialDeposit * registry.getRevenueShare() / 10000)); 
        assertEq(iUsdcToken.balanceOf(treasuryAddr) - treasuryBalanceBefore, initialDeposit * registry.getRevenueShare() / 10000);
        assertEq(agreement.startTs, block.timestamp);
        assertEq(agreement.endTs, 0);
        assertEq(agreement.provClaimedTs, block.timestamp);
        assertEq(agreement.provClaimedAmount, 0);
        assertEq(uint8(agreement.status), uint8(ForestCommon.Status.ACTIVE));
        assertEq(registry.getAllPtAddresses().length, 1);
        assertEq(registry.getAllProviders().length, 1);
        assertEq(pt.getAgreementsCount(), 1);
        assertGt(pt.getActiveAgreementsValue(), 0);
    }

    function testEnterAgreementWithLowFee() public {
        fundAccountWithToken(user1, user1InitialBalance);
        
        IForestProtocol pt = deploySamplePtWithP1Addr();
        deploySampleProviderAndOfferWithP2Addr(pt);

        vm.startPrank(user1);
        uint256 initialDeposit = 1 * 1 * 31 * 24 * 60 * 60; // 1 month fee equivalent
        iUsdcToken.approve(address(pt), initialDeposit);

        uint256 treasuryBalanceBefore = iUsdcToken.balanceOf(address(treasuryAddr));
        vm.expectPartialRevert(ForestCommon.InsufficientAmount.selector);
        uint32 agreementId = pt.enterAgreement(
            0,
            initialDeposit
        );
    }

    function testEnterAgreementWithNonExistantOffer() public {
        fundAccountWithToken(user1, user1InitialBalance);
        
        IForestProtocol pt = deploySamplePtWithP1Addr();
        deploySampleProviderAndOfferWithP2Addr(pt);

        vm.startPrank(user1);
        uint256 initialDeposit = 1 * 2 * 31 * 24 * 60 * 60; 
        iUsdcToken.approve(address(pt), initialDeposit);

        uint256 treasuryBalanceBefore = iUsdcToken.balanceOf(address(treasuryAddr));
        vm.expectRevert();
        uint32 agreementId = pt.enterAgreement(
            11,
            initialDeposit
        );
    }

    function testEnter2AgreementAnd3rdOutofStock() public {
        fundAccountWithToken(user1, user1InitialBalance);
        
        IForestProtocol pt = deploySamplePtWithP1Addr();
        deploySampleProviderAndOfferWithP2Addr(pt);

        vm.startPrank(user1);
        uint256 initialDeposit = 1 * 2 * 31 * 24 * 60 * 60; 
        iUsdcToken.approve(address(pt), 3*initialDeposit);

        pt.enterAgreement(
            0,
            initialDeposit
        );

        pt.enterAgreement(
            0,
            initialDeposit
        );

        assertEq(iUsdcToken.balanceOf(user1), user1InitialBalance*10**iUsdcToken.decimals() - 2*initialDeposit);
        assertEq(iUsdcToken.balanceOf(treasuryAddr), 2*initialDeposit * registry.getRevenueShare() / 10000);
        assertEq(pt.getAgreementsCount(), 2);
        assertEq(pt.getActiveAgreementsValue(), 2*1);
        assertEq(pt.getOffer(0).activeAgreements, 2);

        vm.expectPartialRevert(ForestCommon.LimitExceeded.selector);
        pt.enterAgreement(
            0,
            initialDeposit
        );
    }

    /***********************************|
    |   In PT:                          |
    |   Closing Agreement              |
    |__________________________________*/

    function testCloseAgreement() public {
        uint256 numOfBlocks = 150;
        fundAccountWithToken(user1, user1InitialBalance);
        
        IForestProtocol pt = deploySamplePtWithP1Addr();
        deploySampleProviderAndOfferWithP2Addr(pt);

        vm.startPrank(user1);
        uint256 initialDeposit = 1 * 2 * 31 * 24 * 60 * 60; 
        iUsdcToken.approve(address(pt), initialDeposit);

        uint32 _agreementId = pt.enterAgreement(
            0,
            initialDeposit
        );

        uint oldBlockNum = block.number;
        uint oldBlockTs = block.timestamp;
        uint newBlockNum = block.number + numOfBlocks;
        uint newBlockTs = block.timestamp + BLOCK_TIME*numOfBlocks;
       
        vm.roll(newBlockNum);
        vm.warp(newBlockTs);

        uint256 providerBalanceBefore = iUsdcToken.balanceOf(p2Addr);
        uint256 feeEarned = (newBlockTs-oldBlockTs)*pt.getOffer(pt.getAgreement(_agreementId).offerId).fee;

        pt.closeAgreement(_agreementId);

        ForestCommon.Agreement memory agreement = pt.getAgreement(_agreementId);
        ForestCommon.Offer memory offer = pt.getOffer(agreement.offerId);

        //assertEq(agreement.balance, 0); // provider doesn't automatically withdraw so balanace after close by user is equal to feesEarned
        assertEq(uint8(agreement.status), uint8(ForestCommon.Status.NOTACTIVE));
        assertEq(agreement.startTs, oldBlockTs);
        assertEq(agreement.endTs, newBlockTs);
        //assertEq(agreement.provClaimedAmount, feeEarned); // as above
        //assertEq(iUsdcToken.balanceOf(p2Addr), providerBalanceBefore + feeEarned); // as above
        assertEq(iUsdcToken.balanceOf(user1), user1InitialBalance*10**iUsdcToken.decimals() - (initialDeposit * registry.getRevenueShare() / 10000) - feeEarned);
        assertEq(agreement.provClaimedTs, oldBlockNum);
        assertEq(offer.activeAgreements, 0);        
    }

    function testCloseAgreementProvider() public {
        uint256 numOfBlocks = 150;
        fundAccountWithToken(user1, user1InitialBalance);
        
        IForestProtocol pt = deploySamplePtWithP1Addr();
        deploySampleProviderAndOfferWithP2Addr(pt);

        vm.startPrank(user1);
        uint256 initialDeposit = 1 * 2 * 31 * 24 * 60 * 60; 
        iUsdcToken.approve(address(pt), initialDeposit);

        uint32 _agreementId = pt.enterAgreement(
            0,
            initialDeposit
        );

        uint oldBlockNum = block.number;
        uint oldBlockTs = block.timestamp;
        uint newBlockNum = block.number + numOfBlocks;
        uint newBlockTs = block.timestamp + BLOCK_TIME*numOfBlocks;
       
        vm.roll(newBlockNum);
        vm.warp(newBlockTs);

        vm.startPrank(p1Addr);
        vm.expectRevert();
        pt.closeAgreement(_agreementId);
    }

    function testCloseAgreementProviderAfterUserRunOutOfFunds() public {
        uint256 numOfBlocks = 3 * 31 * 24 * 60 * 60 / 2; // after 3 months
        fundAccountWithToken(user1, user1InitialBalance);
        
        IForestProtocol pt = deploySamplePtWithP1Addr();
        deploySampleProviderAndOfferWithP2Addr(pt);

        vm.startPrank(user1);
        uint256 initialDeposit = 1 * 2 * 31 * 24 * 60 * 60; 
        iUsdcToken.approve(address(pt), initialDeposit);

        uint32 _agreementId = pt.enterAgreement(
            0,
            initialDeposit
        );

        uint oldBlockNum = block.number;
        uint oldBlockTs = block.timestamp;
        uint newBlockNum = block.number + numOfBlocks;
        uint newBlockTs = block.timestamp + BLOCK_TIME*numOfBlocks;
       
        vm.roll(newBlockNum);
        vm.warp(newBlockTs);

        uint256 providerBalanceBefore = iUsdcToken.balanceOf(p2Addr);
        uint256 provideBillAddrBalanceBefore = iUsdcToken.balanceOf(p2BillAddr);

        vm.startPrank(p2Addr);
        pt.closeAgreement(_agreementId);

        ForestCommon.Agreement memory agreement = pt.getAgreement(_agreementId);
        ForestCommon.Offer memory offer = pt.getOffer(agreement.offerId);

        uint256 outStandingReward = pt.getOutstandingReward(agreement.id);
        uint256 feeEarned = (initialDeposit * (10000 - registry.getRevenueShare()) / 10000);

        assertEq(agreement.balance, 0);
        assertEq(uint8(agreement.status), uint8(ForestCommon.Status.NOTACTIVE));
        assertEq(agreement.startTs, oldBlockTs);
        assertEq(agreement.endTs, newBlockTs);
        assertEq(agreement.provClaimedAmount, feeEarned);
        assertEq(iUsdcToken.balanceOf(p2Addr), providerBalanceBefore);
        assertEq(iUsdcToken.balanceOf(p2BillAddr), provideBillAddrBalanceBefore + feeEarned); 
        assertEq(iUsdcToken.balanceOf(user1), user1InitialBalance*10**iUsdcToken.decimals() - initialDeposit);
        assertEq(agreement.provClaimedTs, newBlockTs);
        assertEq(offer.activeAgreements, 0);     
        assertEq(iUsdcToken.balanceOf(address(pt)), 0);
    }

    /***********************************|
    |   In PT:                          |
    |  Withdrawing Fees and Balance     |
    |__________________________________*/

    function testWithdrawFeeWhenOutstanding() public {
        uint256 numOfBlocks = 1 * 31 * 24 * 60 * 60 / 2; // after 1 month
        fundAccountWithToken(user1, user1InitialBalance);
        
        IForestProtocol pt = deploySamplePtWithP1Addr();
        deploySampleProviderAndOfferWithP2Addr(pt);

        vm.startPrank(user1);
        uint256 initialDeposit = 1 * 2 * 31 * 24 * 60 * 60; // deposit 2 months worth of fee
        iUsdcToken.approve(address(pt), initialDeposit);

        uint32 _agreementId = pt.enterAgreement(
            0,
            initialDeposit
        );

        uint oldBlockNum = block.number;
        uint oldBlockTs = block.timestamp;
        uint newBlockNum = block.number + numOfBlocks;
        uint newBlockTs = block.timestamp + BLOCK_TIME*numOfBlocks;
       
        vm.roll(newBlockNum);
        vm.warp(newBlockTs);

        uint256 providerBalanceBefore = iUsdcToken.balanceOf(p2Addr);
        uint256 provideBillAddrBalanceBefore = iUsdcToken.balanceOf(p2BillAddr);
        uint256 feeEarned = pt.getOutstandingReward(_agreementId);

        vm.startPrank(p2Addr);
        pt.withdrawReward(_agreementId);

        ForestCommon.Agreement memory agreement = pt.getAgreement(_agreementId);
        ForestCommon.Offer memory offer = pt.getOffer(agreement.offerId);
        uint256 revenueShare = (registry.getRevenueShare())*initialDeposit/10000;
        
        assertEq(agreement.balance, initialDeposit - revenueShare - feeEarned);
        assertEq(uint8(agreement.status), uint8(ForestCommon.Status.ACTIVE));
        assertEq(agreement.startTs, oldBlockTs);
        assertEq(agreement.endTs, 0);
        assertEq(agreement.provClaimedAmount, feeEarned);
        assertEq(iUsdcToken.balanceOf(p2Addr), providerBalanceBefore);
        assertEq(iUsdcToken.balanceOf(p2BillAddr), provideBillAddrBalanceBefore + feeEarned); 
        assertEq(iUsdcToken.balanceOf(user1), user1InitialBalance*10**iUsdcToken.decimals() - initialDeposit);
        assertEq(agreement.provClaimedTs, newBlockTs);
        assertEq(offer.activeAgreements, 1);     
        assertEq(iUsdcToken.balanceOf(address(pt)), initialDeposit - revenueShare - feeEarned);

    }

    function testWithdrawUserBalanceWhenPrepaidExactMinDeposit() public {
        fundAccountWithToken(user1, user1InitialBalance);
        
        IForestProtocol pt = deploySamplePtWithP1Addr();
        deploySampleProviderAndOfferWithP2Addr(pt);

        vm.startPrank(user1);
        uint256 initialDeposit = 1 * 2 * 31 * 24 * 60 * 60; 
        iUsdcToken.approve(address(pt), initialDeposit);

        pt.enterAgreement(
            0,
            initialDeposit
        );

        vm.roll(block.number + 1);
        vm.warp(block.timestamp + 2);

        vm.expectPartialRevert(ForestCommon.InsufficientAmount.selector);
        pt.withdrawUserBalance(0, 1);

    }

    function testWithdrawUserBalanceWhenPrepaidGtMinDeposit() public {
        fundAccountWithToken(user1, user1InitialBalance);
        
        IForestProtocol pt = deploySamplePtWithP1Addr();
        deploySampleProviderAndOfferWithP2Addr(pt);
        
        vm.startPrank(user1);
        // depositing significantly more (assuming 40 adys per month instead of 30.5) so we can withdraw something and still have over 2months worth of fees in the agreement balance
        uint256 initialDeposit = 1 * 2 * 40 * 24 * 60 * 60; 
        iUsdcToken.approve(address(pt), initialDeposit);

        pt.enterAgreement(
            0,
            initialDeposit
        );

        uint256 amountToWithdraw = 1;
        uint256 userBalanceBefore = iUsdcToken.balanceOf(user1);
        uint256 agreementBalanceBefore = pt.getAgreementBalance(0);
        uint256 contractBalanceBefore = iUsdcToken.balanceOf(address(pt));

        vm.roll(block.number + 1);
        vm.warp(block.timestamp + 2);

        pt.withdrawUserBalance(0, amountToWithdraw);
        uint256 userBalanceAfter = iUsdcToken.balanceOf(user1);
        uint256 agreementBalanceAfter = pt.getAgreementBalance(0);
         uint256 contractBalanceAfter = iUsdcToken.balanceOf(address(pt));

        assertEq(userBalanceAfter - userBalanceBefore, amountToWithdraw);
        assertEq(agreementBalanceBefore - agreementBalanceAfter, amountToWithdraw);
        assertEq(contractBalanceBefore - contractBalanceAfter, amountToWithdraw);

        // try the same thing but user not owner of agreement
        vm.startPrank(user2);
        vm.expectPartialRevert(ForestCommon.OnlyOwnerAllowed.selector);
        pt.withdrawUserBalance(0, amountToWithdraw);
    }

    /***********************************|
    |   In PT:                          |
    |   Toping up                       |
    |__________________________________*/

    function testTopUpAgreement() public {
        fundAccountWithToken(user1, user1InitialBalance);
        
        IForestProtocol pt = deploySamplePtWithP1Addr();
        deploySampleProviderAndOfferWithP2Addr(pt);
        
        vm.startPrank(user1);
        uint256 initialDeposit = 1 * 2 * 31 * 24 * 60 * 60; 
        iUsdcToken.approve(address(pt), 2*initialDeposit);

        pt.enterAgreement(
            0,
            initialDeposit
        );

        uint agreementInitialBalance = pt.getAgreement(0).balance;
        uint userInitialBalance = iUsdcToken.balanceOf(user1);
        uint ptInintialBalance = iUsdcToken.balanceOf(address(pt));
        uint topupAmount = agreementInitialBalance*1/10;

        pt.topUpExistingAgreement(0, topupAmount);
        
        assertEq(pt.getAgreement(0).balance, agreementInitialBalance+topupAmount);
        assertEq(iUsdcToken.balanceOf(user1), userInitialBalance-topupAmount);
        assertEq(iUsdcToken.balanceOf(address(pt)), ptInintialBalance+topupAmount);
    }

    function testTopUpNonExistantAgreement() public {
        fundAccountWithToken(user1, user1InitialBalance);
        
        IForestProtocol pt = deploySamplePtWithP1Addr();
        deploySampleProviderAndOfferWithP2Addr(pt);
        
        vm.startPrank(user1);
        uint256 initialDeposit = 1 * 2 * 31 * 24 * 60 * 60; 
        iUsdcToken.approve(address(pt), 2*initialDeposit);

        pt.enterAgreement(
            0,
            initialDeposit
        );

        vm.expectRevert();
        pt.topUpExistingAgreement(1, 1);
    }

    /***********************************|
    |   In PT:                          |
    |   Pausing/ Unpausing Offer        |
    |__________________________________*/

    function testPauseAndUnpauseOffer() public {
        fundAccountWithToken(user1, user1InitialBalance);
        
        IForestProtocol pt = deploySamplePtWithP1Addr();
        deploySampleProviderAndOfferWithP2Addr(pt);
        
        vm.startPrank(user1);
        uint256 initialDeposit = 1 * 2 * 31 * 24 * 60 * 60; 
        iUsdcToken.approve(address(pt), 2*initialDeposit);
        pt.enterAgreement(
            0,
            initialDeposit
        );
        pt.closeAgreement(0);
        
        vm.startPrank(p2Addr);
        pt.pauseOffer(0);
        
        vm.startPrank(user1);
        vm.expectPartialRevert(ForestCommon.ObjectNotActive.selector);
        pt.enterAgreement(0, initialDeposit);

        vm.startPrank(p2Addr);
        pt.unpauseOffer(0);

        vm.startPrank(user1);
        pt.enterAgreement(0, initialDeposit);
    }

    /***********************************|
    |   In PT:                          |
    |   Closing Request by Provider     |
    |__________________________________*/

    function testRequestOfferClose() public {
        fundAccountWithToken(user1, user1InitialBalance);
        
        IForestProtocol pt = deploySamplePtWithP1Addr();
        deploySampleProviderAndOfferWithP2Addr(pt);
        
        vm.startPrank(user1);
        uint256 initialDeposit = 1 * 2 * 31 * 24 * 60 * 60; 
        iUsdcToken.approve(address(pt), 2*initialDeposit);
        pt.enterAgreement(
            0,
            initialDeposit
        );

        vm.startPrank(p2Addr);
        pt.requestOfferClose(0);
        assertEq(pt.getOffer(0).closeRequestTs, block.timestamp);
        // try closing immediately before termsUpdateDelay reached
        vm.expectRevert(ForestCommon.InvalidState.selector);
        pt.closeAgreement(0);
        // try closing after termsUpdateDelay reached
        vm.warp(block.timestamp + pt.getTermUpdateDelay() + 1);
        pt.closeAgreement(0);
        assertEq(pt.getOffer(0).activeAgreements, 0);
        assertEq(pt.getActiveAgreementsValue(),0);
    }
    
    /***********************************|
    |   In PT:                          |
    |   Setters                         |
    |__________________________________*/

     function testUpdateSettings() public {
        fundAccountWithToken(p3Addr, user1InitialBalance);
        vm.startPrank(p3Addr);
        registry.registerActor(ForestCommon.ActorType.PT_OWNER, address(0), address(0), "providerXYZ");
        
        IForestProtocol pt = deploySamplePtWithP1Addr();
        deploySampleProviderAndOfferWithP2Addr(pt);

        // not owner trying to change params
        vm.startPrank(p2Addr);
        
        vm.expectRevert();
        pt.setDetailsLink("aaa");
        vm.expectRevert();
        pt.setEmissionShares(4000, 4000, 2000);
        vm.expectRevert();
        pt.setFees(1, 1, 1);
        vm.expectRevert();
        pt.setMaxActors(1, 1);
        vm.expectRevert();
        pt.setMinCollateral(2);
        vm.expectRevert();
        pt.setTermUpdateDelay(10);
        vm.expectRevert();
        pt.setOwner(p3Addr);

        // owner changing params
        vm.startPrank(p1Addr);
        
        pt.setMaxActors(3, 4);
        (uint maxProvs, uint maxVals) = pt.getMaxActors();
        assertEq(maxProvs, 3);
        assertEq(maxVals, 4);

        pt.setMinCollateral(150);
        assertEq(pt.getMinCollateral(), 150);

        pt.setFees(12, 13, 14);
        (uint valRegFee, uint provRegFee, uint offerRegFee) = pt.getFees();
        assertEq(valRegFee, 12);
        assertEq(provRegFee, 13);
        assertEq(offerRegFee, 14);

        pt.setTermUpdateDelay(120);
        assertEq(pt.getTermUpdateDelay(), 120);

        pt.setEmissionShares(2000, 2000, 6000);
        (uint provShare, uint valShare, uint ptOwnerShare) = pt.getEmissionShares();
        assertEq(provShare, 2000);
        assertEq(valShare, 2000);
        assertEq(ptOwnerShare, 6000);

        pt.setDetailsLink("aassdd");
        assertEq(pt.getDetailsLink(), "aassdd");

        pt.setOwner(p3Addr);
        assertEq(pt.owner(), p3Addr);

        vm.startPrank(p3Addr);

        // owner changing params for not allowed vals

        vm.expectRevert();
        pt.setEmissionShares(13, 15, 1111111);

        vm.expectRevert();
        pt.transferOwnership(p2Addr);

        vm.expectRevert();
        pt.setOwner(p2Addr);
    }

}
