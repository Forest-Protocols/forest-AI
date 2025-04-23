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


contract ForestRegistryTest is Test {
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

    // Protocol Sample Params
    uint public PARAM_REVENUE_SHARE = 1000; //10.00%
    uint public PARAM_MAX_PTS_NUM = 2;
    uint public PARAM_ACTOR_REG_FEE = 1 ether;
    uint public PARAM_PT_REG_FEE = 10 ether;
    uint public PARAM_ACTOR_IN_PT_REG_FEE = 2 ether;
    uint public PARAM_OFFER_IN_PT_REG_FEE = 3 ether;
    address public PARAM_TREASURY_ADDR = treasuryAddr;
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

    // Actor Sample Deploy Params
    uint public constant INITIAL_COLLATERAL = 10 ether;

    function setUp() public {
        MockedUsdcToken usdcContract = new MockedUsdcToken(address(this));
        iUsdcToken = IERC20Metadata(address(usdcContract));
        ForestToken forestContract = new ForestToken();
        iForestToken = IForestToken(address(forestContract));
        
        // TODO: update the creation process not to be dependent on the updateRegistryAddr function call and correct order
        slasher = new ForestSlasher();
        registry = new ForestRegistry(address(slasher), address(iUsdcToken), address(iForestToken), PARAM_REVENUE_SHARE, PARAM_MAX_PTS_NUM, PARAM_ACTOR_REG_FEE, PARAM_PT_REG_FEE, PARAM_ACTOR_IN_PT_REG_FEE, PARAM_OFFER_IN_PT_REG_FEE, PARAM_TREASURY_ADDR, PARAM_BURN_RATIO);
        slasher.setRegistryAndForestAddr(address(registry));
        forestContract.setRegistryAndSlasherAddr(address(registry));
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

    /***********************************|
    | In Network: Provider Registration |
    |__________________________________*/

    function testRegisterTwoProvidersInProtocol() public {
        fundAccountWithToken(p1Addr, 1000);
        fundAccountWithToken(p2Addr, 1000);
        
        vm.startPrank(p1Addr);
        registry.registerActor(ForestCommon.ActorType.PROVIDER, address(0), address(0), providerDetailsLink); 

        ForestCommon.Actor memory tmp = registry.getActor(p1Addr);

        assertEq(tmp.id, 0);
        assertEq(tmp.registrationTs, block.timestamp);
        assertEq(uint8(tmp.status), uint8(ForestCommon.Status.ACTIVE));
        assertEq(uint8(tmp.actorType), uint8(ForestCommon.ActorType.PROVIDER));
        assertEq(tmp.ownerAddr, p1Addr);
        assertEq(tmp.operatorAddr, p1Addr);
        assertEq(tmp.billingAddr, p1Addr);
        assertEq(tmp.detailsLink, providerDetailsLink);

        assertEq(registry.getAllPtAddresses().length, 0);
        assertEq(registry.getAllProviders().length, 1);
        assertEq(registry.getAllValidators().length, 0);
        assertEq(registry.isRegisteredActiveActor(ForestCommon.ActorType.PROVIDER, p1Addr), true);

        uint256 balanceAfterFirstRegistration = iForestToken.balanceOf(PARAM_TREASURY_ADDR);
        assertGt(balanceAfterFirstRegistration, 0);

        vm.startPrank(p2Addr);

        registry.registerActor(ForestCommon.ActorType.PROVIDER, address(0), address(0), providerDetailsLink); 

        tmp = registry.getActor(p2Addr);

        assertEq(tmp.id, 1);
        assertEq(tmp.registrationTs, block.timestamp);
        assertEq(uint8(tmp.status), uint8(ForestCommon.Status.ACTIVE));
        assertEq(uint8(tmp.actorType), uint8(ForestCommon.ActorType.PROVIDER));
        assertEq(tmp.ownerAddr, p2Addr);
        assertEq(tmp.operatorAddr, p2Addr);
        assertEq(tmp.billingAddr, p2Addr);
        assertEq(tmp.detailsLink, providerDetailsLink);

        assertEq(registry.getAllPtAddresses().length, 0);
        assertEq(registry.getAllProviders().length, 2);
        assertEq(registry.getAllValidators().length, 0);
        assertEq(registry.isRegisteredActiveActor(ForestCommon.ActorType.PROVIDER, p2Addr), true);

        assertGt(iForestToken.balanceOf(PARAM_TREASURY_ADDR), balanceAfterFirstRegistration);
    }

    function testRegisterOneProviderWithAltAddrs() public {
        fundAccountWithToken(p1Addr, 1000);
        vm.startPrank(p1Addr);
        registry.registerActor(ForestCommon.ActorType.PROVIDER, p1OperatorAddr, p1BillAddr, providerDetailsLink);

        ForestCommon.Actor memory tmp = registry.getActor(p1Addr);
        assertEq(tmp.ownerAddr, p1Addr);
        assertEq(tmp.operatorAddr, p1OperatorAddr);
        assertEq(tmp.billingAddr, p1BillAddr);
    }

    function testRegisterProviderAgain() public {
        fundAccountWithToken(p1Addr, 1000);
        vm.startPrank(p1Addr);
        registry.registerActor(ForestCommon.ActorType.PROVIDER, p1OperatorAddr, p1BillAddr, providerDetailsLink);
        
        assertEq(registry.getAllProviders().length, 1);
        
        vm.expectRevert();
        registry.registerActor(ForestCommon.ActorType.PROVIDER, p1OperatorAddr, p1BillAddr, providerDetailsLink);
        
        assertEq(registry.getAllProviders().length, 1);
    }

    function testRegisterTwoActorTypesFromSameOwnerAddr() public {
        fundAccountWithToken(p1Addr, 1000);

        vm.startPrank(p1Addr);
        registry.registerActor(ForestCommon.ActorType.PROVIDER, address(0), address(0), providerDetailsLink);
        vm.expectRevert();
        registry.registerActor(ForestCommon.ActorType.VALIDATOR, address(0), address(0), providerDetailsLink);
        
        assertEq(registry.getAllProviders().length, 1);
        assertEq(registry.getAllValidators().length, 0);
    }

    function testRegisterTwoProvidersWithSameOperator() public {
        fundAccountWithToken(p1Addr, 1000);
        fundAccountWithToken(p2Addr, 1000);

        vm.startPrank(p1Addr);
        registry.registerActor(ForestCommon.ActorType.PROVIDER, address(0), address(0), providerDetailsLink);
        
        assertEq(registry.getAllProviders().length, 1);
        
        vm.startPrank(p2Addr);
        registry.registerActor(ForestCommon.ActorType.PROVIDER, p1OperatorAddr, address(0), providerDetailsLink);
        
        assertEq(registry.getAllProviders().length, 2);
    }

    function testRegisterActorWithNoAllowance() public {
        fundAccountWithToken(p1Addr, 1000);

        vm.startPrank(p1Addr);
        
        iForestToken.approve(address(registry), registry.getActorRegFee() - 1);
        
        vm.expectRevert();
        registry.registerActor(ForestCommon.ActorType.PROVIDER, address(0), address(0), providerDetailsLink);
        
        assertEq(registry.getAllProviders().length, 0);
    }

    /***********************************|
    | In Network: Validator Registration |
    |__________________________________*/

    function testRegisterTwoValidatorsInProtocol() public {
        fundAccountWithToken(p1Addr, 1000);
        fundAccountWithToken(p2Addr, 1000);
        
        vm.startPrank(p1Addr);
        registry.registerActor(ForestCommon.ActorType.VALIDATOR, address(0), address(0), providerDetailsLink); 

        ForestCommon.Actor memory tmp = registry.getActor(p1Addr);

        assertEq(tmp.id, 0);
        assertEq(tmp.registrationTs, block.timestamp);
        assertEq(uint8(tmp.status), uint8(ForestCommon.Status.ACTIVE));
        assertEq(uint8(tmp.actorType), uint8(ForestCommon.ActorType.VALIDATOR));
        assertEq(tmp.ownerAddr, p1Addr);
        assertEq(tmp.operatorAddr, p1Addr);
        assertEq(tmp.billingAddr, p1Addr);
        assertEq(tmp.detailsLink, providerDetailsLink);

        assertEq(registry.getAllPtAddresses().length, 0);
        assertEq(registry.getAllProviders().length, 0);
        assertEq(registry.getAllValidators().length, 1);
        assertEq(registry.isRegisteredActiveActor(ForestCommon.ActorType.VALIDATOR, p1Addr), true);

        uint256 balanceAfterFirstRegistration = iForestToken.balanceOf(PARAM_TREASURY_ADDR);
        assertGt(balanceAfterFirstRegistration, 0);

        vm.startPrank(p2Addr);

        registry.registerActor(ForestCommon.ActorType.VALIDATOR, address(0), address(0), providerDetailsLink); 

        tmp = registry.getActor(p2Addr);

        assertEq(tmp.id, 1);
        assertEq(tmp.registrationTs, block.timestamp);
        assertEq(uint8(tmp.status), uint8(ForestCommon.Status.ACTIVE));
        assertEq(uint8(tmp.actorType), uint8(ForestCommon.ActorType.VALIDATOR));
        assertEq(tmp.ownerAddr, p2Addr);
        assertEq(tmp.operatorAddr, p2Addr);
        assertEq(tmp.billingAddr, p2Addr);
        assertEq(tmp.detailsLink, providerDetailsLink);

        assertEq(registry.getAllPtAddresses().length, 0);
        assertEq(registry.getAllProviders().length, 0);
        assertEq(registry.getAllValidators().length, 2);
        assertEq(registry.isRegisteredActiveActor(ForestCommon.ActorType.VALIDATOR, p2Addr), true);

        assertGt(iForestToken.balanceOf(PARAM_TREASURY_ADDR), balanceAfterFirstRegistration);
    }

    function testRegisterOneValidatorWithAltAddrs() public {
        fundAccountWithToken(p1Addr, 1000);
        vm.startPrank(p1Addr);
        registry.registerActor(ForestCommon.ActorType.VALIDATOR, p1OperatorAddr, p1BillAddr, providerDetailsLink);

        ForestCommon.Actor memory tmp = registry.getActor(p1Addr);
        assertEq(tmp.ownerAddr, p1Addr);
        assertEq(tmp.operatorAddr, p1OperatorAddr);
        assertEq(tmp.billingAddr, p1BillAddr);
    }

    function testRegisterValidatorAgain() public {
        fundAccountWithToken(p1Addr, 1000);
        vm.startPrank(p1Addr);
        registry.registerActor(ForestCommon.ActorType.VALIDATOR, p1OperatorAddr, p1BillAddr, providerDetailsLink);
        
        assertEq(registry.getAllValidators().length, 1);
        
        vm.expectRevert();
        registry.registerActor(ForestCommon.ActorType.VALIDATOR, p1OperatorAddr, p1BillAddr, providerDetailsLink);
        
        assertEq(registry.getAllValidators().length, 1);
    }

    function testRegisterTwoValidatorsWithSameOperator() public {
        fundAccountWithToken(p1Addr, 1000);
        fundAccountWithToken(p2Addr, 1000);

        vm.startPrank(p1Addr);
        registry.registerActor(ForestCommon.ActorType.VALIDATOR, address(0), address(0), providerDetailsLink);
        
        assertEq(registry.getAllValidators().length, 1);
        
        vm.startPrank(p2Addr);
        registry.registerActor(ForestCommon.ActorType.VALIDATOR, p1OperatorAddr, address(0), providerDetailsLink);
        
        assertEq(registry.getAllValidators().length, 2);
    }

    /*******************************************|
    | In Network: Actor Registration Common    |
    |___________________________________________*/

    function testUpdateActorDetails() public {
        fundAccountWithToken(p1Addr, 11);
        
        vm.startPrank(p1Addr);
        registry.registerActor(ForestCommon.ActorType.PROVIDER, address(0), address(0), "k1n2k3jn1k23jn1");
        assertEq(registry.getProvidersCount(), 1);
        assertEq(registry.getActor(p1Addr).detailsLink, "k1n2k3jn1k23jn1");
        assertEq(registry.getActor(p1Addr).ownerAddr, p1Addr);
        assertEq(registry.getActor(p1Addr).operatorAddr, p1Addr);
        assertEq(registry.getActor(p1Addr).billingAddr, p1Addr);
        registry.updateActorDetails(ForestCommon.ActorType.PROVIDER, p1OperatorAddr, p1BillAddr, providerDetailsLink);
        assertEq(registry.getActor(p1Addr).detailsLink, providerDetailsLink);
        assertEq(registry.getActor(p1Addr).ownerAddr, p1Addr);
        assertEq(registry.getActor(p1Addr).operatorAddr, p1OperatorAddr);
        assertEq(registry.getActor(p1Addr).billingAddr, p1BillAddr);
        registry.updateActorDetails(ForestCommon.ActorType.PROVIDER, address(0), address(0), providerDetailsLink);
        assertEq(registry.getActor(p1Addr).ownerAddr, p1Addr);
        assertEq(registry.getActor(p1Addr).operatorAddr, p1Addr);
        assertEq(registry.getActor(p1Addr).billingAddr, p1Addr);
        vm.expectRevert();
        registry.updateActorDetails(ForestCommon.ActorType.PROVIDER, address(0), address(0), "");
    }

    /***********************************|
    |   In Network: PT Registration    |
    |__________________________________*/

    function testRegisterOneProduct() public {
        fundAccountWithToken(p1Addr, 11);

        vm.startPrank(p1Addr);
        registry.registerActor(ForestCommon.ActorType.PT_OWNER, address(0), address(0), providerDetailsLink);
        address ptAddr = registry.createProtocol(1, 2, 1, 1, 2, 3, 10, 4000, 4000, 2000, ptDetailsLink);
        IForestProtocol pt = IForestProtocol(ptAddr);

        assertEq(ptAddr, registry.getAllPtAddresses()[0]);
        assertEq(registry.getAllPtAddresses().length, 1);
       
        assertEq(iForestToken.balanceOf(PARAM_TREASURY_ADDR), ((registry.getPtRegFee()*(10000-registry.getBurnRatio())/10000)+(registry.getActorRegFee()*(10000-registry.getBurnRatio())/10000)));

        (uint256 maxVals, uint256 maxProvs) = pt.getMaxActors();
        (uint256 provRegFee, uint valRegFee, uint offerRegFee) = pt.getFees();
        (uint provShare, uint valShare, uint ptOwnerShare) = pt.getEmissionShares();

        assertEq(pt.getRegistryAddr(), address(registry));
        assertEq(pt.getOwnerAddr(), p1Addr);
        assertEq(maxVals, 1);
        assertEq(maxProvs, 2);
        assertEq(pt.getMinCollateral(), 1);
        assertEq(provRegFee, 1);
        assertEq(valRegFee, 2);
        assertEq(offerRegFee, 3);
        assertEq(pt.getTermUpdateDelay(), 10);
        assertEq(provShare, 4000);
        assertEq(valShare, 4000);
        assertEq(ptOwnerShare, 2000);
        assertEq(pt.getDetailsLink(), ptDetailsLink);
        assertEq(registry.isPtRegisteredAndActive(ptAddr), true);
        
        assertEq(pt.getOffersCount(), 0);
        assertEq(pt.getAgreementsCount(), 0);
        assertEq(pt.getAllProviderIds().length, 0);
        assertEq(pt.getAllValidatorIds().length, 0);

        assertEq(pt.getActiveAgreementsValue(), 0);
    }

    function testRegisterTwoProducts() public {
        fundAccountWithToken(p1Addr, 11);
        fundAccountWithToken(p2Addr, 11);

        vm.startPrank(p1Addr);
        registry.registerActor(ForestCommon.ActorType.PT_OWNER, address(0), address(0), providerDetailsLink);
        
        address ptAddr = registry.createProtocol(1, 2, 1, 1, 2, 3, 10, 4000, 4000, 2000, ptDetailsLink);
        IForestProtocol pt = IForestProtocol(ptAddr);

        vm.startPrank(p2Addr);
        registry.registerActor(ForestCommon.ActorType.PT_OWNER, address(0), address(0), providerDetailsLink);
        
        address pt2Addr = registry.createProtocol(2, 3, 2, 2, 3, 4, 11, 3500, 3500, 3000, ptDetailsLink);
        IForestProtocol pt2 = IForestProtocol(pt2Addr);

        // check protocol level data
        
        assertEq(ptAddr, registry.getAllPtAddresses()[0]);
        assertEq(pt2Addr, registry.getAllPtAddresses()[1]);
        assertEq(registry.getAllPtAddresses().length, 2);
       
        assertEq(iForestToken.balanceOf(PARAM_TREASURY_ADDR), 2*((registry.getPtRegFee()*(10000-registry.getBurnRatio())/10000)+(registry.getActorRegFee()*(10000-registry.getBurnRatio())/10000)));

        // check first PT data
        
        (uint256 maxVals, uint256 maxProvs) = pt.getMaxActors();
        (uint256 provRegFee, uint valRegFee, uint offerRegFee) = pt.getFees();
        (uint provShare, uint valShare, uint ptOwnerShare) = pt.getEmissionShares();

        assertEq(pt.getRegistryAddr(), address(registry));
        assertEq(pt.getOwnerAddr(), p1Addr);
        assertEq(maxVals, 1);
        assertEq(maxProvs, 2);
        assertEq(pt.getMinCollateral(), 1);
        assertEq(provRegFee, 1);
        assertEq(valRegFee, 2);
        assertEq(offerRegFee, 3);
        assertEq(pt.getTermUpdateDelay(), 10);
        assertEq(provShare, 4000);
        assertEq(valShare, 4000);
        assertEq(ptOwnerShare, 2000);
        assertEq(pt.getDetailsLink(), ptDetailsLink);
        assertEq(registry.isPtRegisteredAndActive(ptAddr), true);
        
        assertEq(pt.getOffersCount(), 0);
        assertEq(pt.getAgreementsCount(), 0);
        assertEq(pt.getAllProviderIds().length, 0);
        assertEq(pt.getAllValidatorIds().length, 0);

        assertEq(pt.getActiveAgreementsValue(), 0);

        /// check second PT data

        (maxVals, maxProvs) = pt2.getMaxActors();
        (provRegFee, valRegFee, offerRegFee) = pt2.getFees();
        (provShare, valShare, ptOwnerShare) = pt2.getEmissionShares();

        assertEq(pt2.getRegistryAddr(), address(registry));
        assertEq(pt2.getOwnerAddr(), p2Addr);
        assertEq(maxVals, 2);
        assertEq(maxProvs, 3);
        assertEq(pt2.getMinCollateral(), 2);
        assertEq(provRegFee, 2);
        assertEq(valRegFee, 3);
        assertEq(offerRegFee, 4);
        assertEq(pt2.getTermUpdateDelay(), 11);
        assertEq(provShare, 3500);
        assertEq(valShare, 3500);
        assertEq(ptOwnerShare, 3000);
        assertEq(pt2.getDetailsLink(), ptDetailsLink);
        assertEq(registry.isPtRegisteredAndActive(pt2Addr), true);
        
        assertEq(pt.getOffersCount(), 0);
        assertEq(pt.getAgreementsCount(), 0);
        assertEq(pt.getAllProviderIds().length, 0);
        assertEq(pt.getAllValidatorIds().length, 0);

        assertEq(pt.getActiveAgreementsValue(), 0);
    }

     function testRegisterOneProductWithNonPtOwnerActor() public {
        fundAccountWithToken(p1Addr, 11);

        vm.startPrank(p1Addr);
        registry.registerActor(ForestCommon.ActorType.PROVIDER, address(0), address(0), providerDetailsLink);
        
        vm.expectRevert();
        address ptAddr = registry.createProtocol(1, 2, 1, 1, 2, 3, 10, 4000, 4000, 2000, ptDetailsLink);
     }

    function testRegisterOneProductWithNotRegisteredActor() public {
        fundAccountWithToken(p1Addr, 11);

        vm.startPrank(p1Addr);
        
        vm.expectPartialRevert(ForestCommon.OnlyOwnerAllowed.selector);
        address ptAddr = registry.createProtocol(1, 2, 1, 1, 2, 3, 10, 4000, 4000, 2000, ptDetailsLink);
     }

    function testRegisterProductWithSharesNot100() public {
        fundAccountWithToken(p1Addr, 11);
        
        vm.startPrank(p1Addr);
        registry.registerActor(ForestCommon.ActorType.PT_OWNER, address(0), address(0), providerDetailsLink);
        
        vm.expectPartialRevert(ForestCommon.InvalidParam.selector);
        address ptAddr = registry.createProtocol(1, 2, 1, 1, 2, 3, 10, 1000, 4000, 2000, ptDetailsLink);
    }

    function testRestRegisterProductWithEmptyDetails() public {
        fundAccountWithToken(p1Addr, 11);
        
        vm.startPrank(p1Addr);
        registry.registerActor(ForestCommon.ActorType.PT_OWNER, address(0), address(0), providerDetailsLink);
        
        vm.expectPartialRevert(ForestCommon.InvalidParam.selector);
        address ptAddr = registry.createProtocol(1, 2, 1, 1, 2, 3, 10, 4000, 4000, 2000, "");
    }

    function testRegisterTooManyProducts() public {
        fundAccountWithToken(p1Addr, 31);
        
        vm.startPrank(p1Addr);
        registry.registerActor(ForestCommon.ActorType.PT_OWNER, address(0), address(0), "");
        
        registry.createProtocol(1, 2, 1, 1, 2, 3, 10, 4000, 4000, 2000, ptDetailsLink);
        registry.createProtocol(1, 2, 1, 1, 2, 3, 10, 4000, 4000, 2000, ptDetailsLink);
        vm.expectPartialRevert(ForestCommon.LimitExceeded.selector);
        registry.createProtocol(1, 2, 1, 1, 2, 3, 10, 4000, 4000, 2000, ptDetailsLink);
    }

    /***********************************|
    |   In Network: Updating settings  |
    |__________________________________*/

    function testUpdateProtocolSettings() public {
        // not owner trying to change params
        vm.startPrank(p1Addr);
        
        vm.expectRevert();
        registry.setBurnRatio(1000);
        vm.expectRevert();
        registry.setMaxProtocolsNum(10);
        vm.expectRevert();
        registry.setOfferInPtRegFee(1000);
        vm.expectRevert();
        registry.setPtRegFee(1000);
        vm.expectRevert();
        registry.setRevenueShare(1000);
        vm.expectRevert();
        registry.setTreasuryAddrParam(address(0));
        vm.expectRevert();
        registry.setSlasherAddress(address(123));
        vm.expectRevert();
        registry.setUsdcTokenAddress(address(123));
        vm.expectRevert();
        registry.setForestTokenAddress(address(123));
        vm.stopPrank();

        // owner changing params
        vm.startPrank(address(this));

        assertEq(PARAM_BURN_RATIO, registry.getBurnRatio());
        registry.setBurnRatio(1000);
        assertEq(1000, registry.getBurnRatio());

        assertEq(PARAM_MAX_PTS_NUM, registry.getMaxProtocolsNum());
        registry.setMaxProtocolsNum(10);
        assertEq(10, registry.getMaxProtocolsNum());

        assertEq(PARAM_ACTOR_REG_FEE, registry.getActorRegFee());
        registry.setActorRegFee(1000);
        assertEq(1000, registry.getActorRegFee());

        assertEq (PARAM_PT_REG_FEE, registry.getPtRegFee());
        registry.setPtRegFee(1000);
        assertEq(1000, registry.getPtRegFee());

        assertEq(PARAM_ACTOR_IN_PT_REG_FEE, registry.getActorInPtRegFee());
        registry.setActorInPtRegFee(1000);
        assertEq(1000, registry.getActorInPtRegFee());

        assertEq(PARAM_OFFER_IN_PT_REG_FEE, registry.getOfferInPtRegFee());
        registry.setOfferInPtRegFee(1000);
        assertEq(1000, registry.getOfferInPtRegFee());

        assertEq(PARAM_REVENUE_SHARE, registry.getRevenueShare());
        registry.setRevenueShare(1000);
        assertEq(1000, registry.getRevenueShare());

        assertEq(PARAM_TREASURY_ADDR, registry.getTreasuryAddr());
        registry.setTreasuryAddrParam(address(0));
        assertEq(address(0), registry.getTreasuryAddr());

        assertEq(address(slasher), registry.getSlasherAddr());
        registry.setSlasherAddress(address(123));
        assertEq(address(123), registry.getSlasherAddr());

        assertEq(address(iUsdcToken), registry.getUsdcTokenAddr());
        registry.setUsdcTokenAddress(address(123));
        assertEq(address(123), registry.getUsdcTokenAddr());

        assertEq(address(iForestToken), registry.getForestTokenAddr());
        registry.setForestTokenAddress(address(123));
        assertEq(address(123), registry.getForestTokenAddr());

        // owner changing params for not allowed vals

        vm.expectRevert();
        registry.setBurnRatio(10001);

        vm.expectRevert();
        registry.setRevenueShare(10001);

        vm.expectRevert();
        registry.setSlasherAddress(address(0));

        vm.expectRevert();
        registry.setUsdcTokenAddress(address(0));

        vm.expectRevert();
        registry.setForestTokenAddress(address(0));
    }

    function testTransferOwnership()  public {
        registry.transferOwnership(p1Addr);
        assertEq(registry.owner(), p1Addr);

        // transfer ownership again, now using old owner / not owner
        vm.expectRevert();
        registry.transferOwnership(p2Addr);
    }

    /***********************************|
    |  In Network: Pausing / Unpausing |
    |__________________________________*/

    function testPause() public {
        // check that the contract is not paused
        assertFalse(registry.paused());

        // pause the contract
        registry.pause();

        // check that the contract is paused
        assertTrue(registry.paused());

        // unpause the contract
        registry.unpause();

        // check that the contract is not paused
        assertFalse(registry.paused());
    }

    function testPauseNotOwner() public {
        vm.startPrank(p1Addr);
        // check that the contract is not paused
        assertFalse(registry.paused());

        // pause the contract
        vm.expectRevert();
        registry.pause();

        // check that the contract is paused
        assertFalse(registry.paused());

        vm.startPrank(address(this));
        registry.pause();

        vm.startPrank(p1Addr);
        // unpause the contract
        vm.expectRevert();
        registry.unpause();

        // check that the contract is not paused
        assertTrue(registry.paused());
    }

    function testOnlyWhenNotPaused() public {
        fundAccountWithToken(p1Addr, 11);
        
        vm.startPrank(p1Addr);
        registry.registerActor(ForestCommon.ActorType.PROVIDER, address(0), address(0), "");

        vm.startPrank(address(this));
        registry.pause();

        vm.startPrank(p2Addr);
        vm.expectRevert();
        registry.registerActor(ForestCommon.ActorType.PROVIDER, address(0), address(0), "");

        vm.startPrank(p1Addr);
        vm.expectRevert();
        registry.createProtocol(1, 2, 1, 1, 2, 3, 10, 4000, 4000, 2000, ptDetailsLink);
    }
}
