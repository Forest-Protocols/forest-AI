pragma solidity ^0.8.22;

// forge script script/MinimalAnvilTestDeployment.sol:MinimalAnvilTestDeployment --rpc-url 127.0.0.1:8545 --broadcast
// forge script script/MinimalAnvilTestDeployment.sol:MinimalAnvilTestDeployment --sig "enterAgreement(address)" 0x6D544390Eb535d61e196c87d6B9c80dCD8628Acd --rpc-url 127.0.0.1:8545 --broadcast

// forge script script/MinimalAnvilTestDeployment.sol:MinimalAnvilTestDeployment --chain 11155420 --rpc-url $OP_SEPOLIA_RPC_URL --broadcast
// forge script script/MinimalAnvilTestDeployment.sol:MinimalAnvilTestDeployment --chain 11155420 --rpc-url $OP_SEPOLIA_RPC_URL --sig "enterAgreement(address)" 0x4a678e4BBD17ae2b89FcB273fA1364F0e93Fc0C9 --broadcast

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import "@openzeppelin/contracts/interfaces/IERC20Metadata.sol";

import "../src/ForestSlasher.sol";

import {IForestRegistry} from "../src/interfaces/IForestRegistry.sol";
import {IForestSlasher} from "../src/interfaces/IForestSlasher.sol";
import {IForestProtocol} from "../src/interfaces/IForestProtocol.sol";
import {IForestToken} from "../src/interfaces/IForestToken.sol";

contract MinimalAnvilTestDeployment is Script {
    uint256 runOn = vm.envUint("RUN_ON");

    address public constant PT1_ADDR = 0x6D544390Eb535d61e196c87d6B9c80dCD8628Acd;
    address public constant PT2_ADDR = 0xB1eDe3F5AC8654124Cb5124aDf0Fd3885CbDD1F7;

    IForestRegistry public iForestRegistry;
    IForestSlasher public iForestSlasher;
    IERC20Metadata public iUsdcToken;
    IForestToken public iForestToken;

    address public usdcTokenAddr;
    address public forestTokenAddr;
    address public slasherAddr;
    address public registryAddr;

    uint256 public privKey;
    address public keyAddr;

    uint public constant MAX_VALS_NUM = 1;
    uint public constant MAX_PROVS_NUM = 20;
    uint public constant MIN_COLLATERAL = 10;
    uint public constant VAL_REG_FEE = 10;
    uint public constant PROV_REG_FEE = 10;
    uint public constant OFFER_REG_FEE = 15;
    uint public constant TERM_UPDATE_DELAY = 500;
    uint public constant PROV_SHARE = 6000;
    uint public constant VAL_SHARE = 1000;
    uint public constant PT_OWNER_SHARE = 3000;
    uint public constant FEE_USDC = 15; // 15 * 2.635200 = 39.52800

    uint256 ptoPrivKey = vm.envUint("PRIV_KEY_PTO_IG");
    address ptoAddr = vm.addr(ptoPrivKey);
    uint256 prov1PrivKey = vm.envUint("PRIV_KEY_PROV1_IG");
    address prov1Addr = vm.addr(prov1PrivKey);
    uint256 prov2PrivKey = vm.envUint("PRIV_KEY_PROV2_IG");
    address prov2Addr = vm.addr(prov2PrivKey);
    uint256 val1PrivKey = vm.envUint("PRIV_KEY_VAL1_IG");
    address val1Addr = vm.addr(val1PrivKey);
    uint256 user1PrivKey = vm.envUint("PRIV_KEY_USER1_IG");
    address user1Addr = vm.addr(user1PrivKey);
    
    string public PTO_DETAILS_LINK = vm.envString("PTO_DETAILS_LINK_IG");
    string public PROV_DETAILS_LINK = vm.envString("PROV1_DETAILS_LINK_IG");
    string public OFFER_DETAILS_LINK = vm.envString("OFFER_DETAILS_LINK_IG");
    string public PC_DETAILS_LINK = vm.envString("PT_DETAILS_LINK_IG");
    string public VAL_DETAILS_LINK = vm.envString("VAL1_DETAILS_LINK_IG");

    uint public constant BLOCK_TIME = 2;

    // Actor Sample Deploy Params
    uint public constant INITIAL_COLLATERAL = 10;

    function fundAccountWithToken(uint256 _privKeyOrigin, address _addressTarget, uint256 _privKeyTarget, uint256 _amount) public {
        // fund account with tokens
        vm.startBroadcast(_privKeyOrigin);
        iUsdcToken.transfer(_addressTarget, _amount * 10 ** iUsdcToken.decimals());
        iForestToken.transfer(_addressTarget, _amount * 10 ** iForestToken.decimals());
        payable(_addressTarget).transfer(50000000000000000);
        vm.stopBroadcast();

        // the funded account approves the tokens to be spent by the registry and slasher
        vm.startBroadcast(_privKeyTarget);
        iUsdcToken.approve(
            address(registryAddr),
            type(uint256).max  // Approve maximum amount to ensure sufficient allowance
        );
        iForestToken.approve(
            address(slasherAddr),
            type(uint256).max  // Approve maximum amount to ensure sufficient allowance
        );
        iForestToken.approve(
            address(registryAddr),
            type(uint256).max  // Approve maximum amount to ensure sufficient allowance
        );
        vm.stopBroadcast();
    }

    function setUp() public {
        if (runOn == 0) {
            // 0 - local
            privKey = vm.envUint("LOCAL_PRIV_KEY");
            keyAddr = vm.addr(privKey);
            usdcTokenAddr = vm.envAddress("LOCAL_MOCKED_USDC_TOKEN_ADDRESS");
            forestTokenAddr = vm.envAddress("LOCAL_FOREST_TOKEN_ADDRESS");
            slasherAddr = vm.envAddress("LOCAL_SLASHER_ADDRESS");
            registryAddr = vm.envAddress("LOCAL_REGISTRY_ADDRESS");
        } else if (runOn == 1) {
            // 1 - op sepolia
            privKey = vm.envUint("OP_SEPOLIA_PRIV_KEY");
            keyAddr = vm.addr(privKey);
            usdcTokenAddr = vm.envAddress("OP_SEPOLIA_MOCKED_USDC_TOKEN_ADDRESS");
            forestTokenAddr = vm.envAddress("OP_SEPOLIA_FOREST_TOKEN_ADDRESS");
            slasherAddr = vm.envAddress("OP_SEPOLIA_SLASHER_ADDRESS");
            registryAddr = vm.envAddress("OP_SEPOLIA_REGISTRY_ADDRESS");
        } else if (runOn == 2) {
            // 2 - op mainnet
            privKey = vm.envUint("OP_MAINNET_PRIV_KEY");
            keyAddr = vm.addr(privKey);
            usdcTokenAddr = vm.envAddress("OP_MAINNET_USDC_TOKEN_ADDRESS");
            forestTokenAddr = vm.envAddress("OP_MAINNET_FOREST_TOKEN_ADDRESS");
            slasherAddr = vm.envAddress("OP_MAINNET_SLASHER_ADDRESS");
            registryAddr = vm.envAddress("OP_MAINNET_REGISTRY_ADDRESS");
        } else {
            revert("Invalid runOn value");
        }

        iForestRegistry = IForestRegistry(registryAddr);
        iForestSlasher = IForestSlasher(slasherAddr);
        iUsdcToken = IERC20Metadata(usdcTokenAddr);
        iForestToken = IForestToken(forestTokenAddr);
    }

    function run() public {
        fundAccountWithToken(privKey, ptoAddr, ptoPrivKey, 1000000);
        fundAccountWithToken(privKey, prov1Addr, prov1PrivKey, 1000000);
        fundAccountWithToken(privKey, prov2Addr, prov2PrivKey, 1000000);
        fundAccountWithToken(privKey, val1Addr, val1PrivKey, 1000000);
        fundAccountWithToken(privKey, user1Addr, user1PrivKey, 1000000);

        // register a protocol owner
        vm.startBroadcast(ptoPrivKey);
        console2.log("Registering protocol owner");
        iForestRegistry.registerActor(ForestCommon.ActorType.PT_OWNER, address(0), address(0), PTO_DETAILS_LINK);
        // register a protocol 
        console2.log("Creating protocol");
        address protocolAddr = iForestRegistry.createProtocol(MAX_VALS_NUM, MAX_PROVS_NUM, MIN_COLLATERAL, VAL_REG_FEE, PROV_REG_FEE, OFFER_REG_FEE, TERM_UPDATE_DELAY, PROV_SHARE, VAL_SHARE, PT_OWNER_SHARE, PC_DETAILS_LINK);
        console2.log("Protocol 1 created at address %s", protocolAddr);
        address protocolAddr2 = iForestRegistry.createProtocol(MAX_VALS_NUM, MAX_PROVS_NUM, MIN_COLLATERAL, VAL_REG_FEE, PROV_REG_FEE, OFFER_REG_FEE, TERM_UPDATE_DELAY, PROV_SHARE, VAL_SHARE, PT_OWNER_SHARE, PC_DETAILS_LINK);
        console2.log("Protocol 2 created at address %s", protocolAddr2);
        IForestProtocol protocol = IForestProtocol(protocolAddr);
        IForestProtocol protocol2 = IForestProtocol(protocolAddr2);
        vm.stopBroadcast();
        
        // register a provider
        console2.log("Registering provider 1 with address %s", prov1Addr);
        vm.startBroadcast(prov1PrivKey);
        uint24 prov1Id = iForestRegistry.registerActor(ForestCommon.ActorType.PROVIDER, address(0), address(0), PROV_DETAILS_LINK);
        console2.log("Provider 1 registered with id %s", prov1Id);
        // register a provider in 2 protocols
        console2.log("Registering provider 1 in protocol 1");
        protocol.registerActor(ForestCommon.ActorType.PROVIDER, INITIAL_COLLATERAL);
        console2.log("Registering provider 1 in protocol 2");
        protocol2.registerActor(ForestCommon.ActorType.PROVIDER, INITIAL_COLLATERAL);
        // register an offer in 2 protocols
        console2.log("Registering offer in protocol 1");
        uint32 offerId = protocol.registerOffer(
            prov1Addr,
            FEE_USDC,
            1000,
            OFFER_DETAILS_LINK
        );
        address offerAddr = protocol.getOffer(offerId).ownerAddr;
        console2.log("Offer with id %s registered in protocol 1 under provider address %s", offerId, offerAddr);
        console2.log("Registering offer in protocol 2");
        offerId = protocol2.registerOffer(
            prov1Addr,
            FEE_USDC,
            1000,
            OFFER_DETAILS_LINK
        );
        offerAddr = protocol2.getOffer(offerId).ownerAddr;
        console2.log("Offer with id %s registered in protocol 2 under provider address %s", offerId, offerAddr);
        vm.stopBroadcast();

        // register another provider
        console2.log("Registering provider 2 with address %s", prov2Addr);
        vm.startBroadcast(prov2PrivKey);
        uint24 prov2Id = iForestRegistry.registerActor(ForestCommon.ActorType.PROVIDER, address(0), address(0), PROV_DETAILS_LINK);
        console2.log("Provider 2 registered with id %s", prov2Id);
        // register a provider in 2 protocols
        console2.log("Registering provider 2 in protocol 1");
        protocol.registerActor(ForestCommon.ActorType.PROVIDER, INITIAL_COLLATERAL);
        console2.log("Registering provider 2 in protocol 2");
        protocol2.registerActor(ForestCommon.ActorType.PROVIDER, INITIAL_COLLATERAL);
        // register an offer in 2 protocols
        console2.log("Registering offer in protocol 1");
        offerId = protocol.registerOffer(
            prov2Addr,
            FEE_USDC,
            1000,
            OFFER_DETAILS_LINK
        );
        offerAddr = protocol.getOffer(offerId).ownerAddr;
        console2.log("Offer with id %s registered in protocol 1 under provider address %s", offerId, offerAddr);
        console2.log("Registering offer in protocol 2");
        offerId = protocol2.registerOffer(
            prov2Addr,
            FEE_USDC,
            1000,
            OFFER_DETAILS_LINK
        );
        offerAddr = protocol2.getOffer(offerId).ownerAddr;
        console2.log("Offer with id %s registered in protocol 2 under provider address %s", offerId, offerAddr);
        vm.stopBroadcast();

        // register a validator
        vm.startBroadcast(val1PrivKey);
        iForestRegistry.registerActor(ForestCommon.ActorType.VALIDATOR, address(0), address(0), VAL_DETAILS_LINK);
        // register a validator in 2 protocols
        console2.log("Registering validator in protocol 1");
        protocol.registerActor(ForestCommon.ActorType.VALIDATOR, INITIAL_COLLATERAL);
        console2.log("Registering validator in protocol 2");
        protocol2.registerActor(ForestCommon.ActorType.VALIDATOR, INITIAL_COLLATERAL);
        vm.stopBroadcast();
    }

    function enterAgreement() public {
        console2.log("User 1 address: %s", user1Addr);
        console2.log("Protocol address: %s", PT1_ADDR);
        console2.log("Entering agreement");
        IForestProtocol protocol = IForestProtocol(PT1_ADDR);

        vm.startBroadcast(user1PrivKey);
        // approve the protocol to spend the user's tokens
        iUsdcToken.approve(address(protocol), type(uint256).max);
        // enter an agreement wtih prov1
        uint256 fee = protocol.getOffer(0).fee;
        uint32 agreementId = protocol.enterAgreement(0, 2 * 2635200 * fee);
        console2.log("Agreement with id %s entered with prov1", agreementId);
        vm.stopBroadcast();
    }

    function enter2AgreementsAsValidator() public {
        console2.log("Validator 1 address: %s", val1Addr);
        console2.log("Protocol address: %s", PT1_ADDR);
        console2.log("Entering agreement");
        IForestProtocol protocol = IForestProtocol(PT1_ADDR);

        vm.startBroadcast(val1PrivKey);
        // enter an agreement wtih prov1
        iUsdcToken.approve(address(protocol), type(uint256).max);
        uint256 fee = protocol.getOffer(0).fee;
        uint32 agreementId = protocol.enterAgreement(0, 2 * 2635200 * fee);
        console2.log("Agreement with id %s entered with prov1", agreementId);
        // enter an agreement wtih prov2
        agreementId = protocol.enterAgreement(1, 2 * 2635200 * fee);
        console2.log("Agreement with id %s entered with prov2", agreementId);
        vm.stopBroadcast();

        console2.log("Validator 1 address: %s", val1Addr);
        console2.log("Protocol address: %s", PT2_ADDR);
        console2.log("Entering agreement");
        protocol = IForestProtocol(PT2_ADDR);

        vm.startBroadcast(val1PrivKey);
        // enter an agreement wtih prov1
        iUsdcToken.approve(address(protocol), type(uint256).max);
        fee = protocol.getOffer(0).fee;
        agreementId = protocol.enterAgreement(0, 2 * 2635200 * fee);
        console2.log("Agreement with id %s entered with prov1", agreementId);
        // enter an agreement wtih prov2
        agreementId = protocol.enterAgreement(1, 2 * 2635200 * fee);
        console2.log("Agreement with id %s entered with prov2", agreementId);
        vm.stopBroadcast();
    }

    function closeCurrentEpoch() public {
        vm.startBroadcast(ptoPrivKey);
        console2.log("block.number", block.number);
        console2.log("Closing current epoch");
        uint256 currentEpochEndBlockNum = iForestSlasher.getCurrentEpochEndBlockNum();
        console2.log("Current epoch end block number: %s", currentEpochEndBlockNum);
        uint256 closedEpochNum = iForestSlasher.closeEpoch();
        console2.log("Closed epoch number: %s", closedEpochNum);
        vm.stopBroadcast();
    }

    function commitResults() public {
        console2.log("Validator 1 address: %s", val1Addr);
        console2.log("Committing results");
        console2.log("block.number", block.number);
        console2.log("getCurrentEpochEndBlockNum", iForestSlasher.getCurrentEpochEndBlockNum());
        console2.log("computeCurrentEpochEndBlockNum", iForestSlasher.computeCurrentEpochEndBlockNum());

        vm.startBroadcast(val1PrivKey);
        // Create a memory array of ProviderScore for protocol 1
        ForestSlasher.ProviderScore[] memory provScores = new ForestSlasher.ProviderScore[](2);
        provScores[0] = ForestSlasher.ProviderScore(1, 2, 0);
        provScores[1] = ForestSlasher.ProviderScore(2, 3, 1);

        // Create a memory array of ProviderScore for protocol 2
        ForestSlasher.ProviderScore[] memory provScores2 = new ForestSlasher.ProviderScore[](2);
        provScores2[0] = ForestSlasher.ProviderScore(1, 22, 0);
        provScores2[1] = ForestSlasher.ProviderScore(2, 8, 1);
        
        // Get the contract instance
        ForestSlasher slasher = ForestSlasher(address(iForestSlasher));
        bytes32 commitHash1 = slasher.computeHash(provScores); 
        iForestSlasher.commit(commitHash1, val1Addr, PT1_ADDR, "testLink.com");
        bytes32 commitHash2 = slasher.computeHash(provScores2);
        iForestSlasher.commit(commitHash2, val1Addr, PT2_ADDR, "testLink.com");
        vm.stopBroadcast();
    }

    function revealResults() public {
        console2.log("Validator 1 address: %s", val1Addr);
        console2.log("Revealing results"); 
        console2.log("block.number", block.number);
        console2.log("getCurrentEpochEndBlockNum", iForestSlasher.getCurrentEpochEndBlockNum());
        console2.log("computeCurrentEpochEndBlockNum", iForestSlasher.computeCurrentEpochEndBlockNum());

        vm.startBroadcast(val1PrivKey);
        // Create a memory array of ProviderScore
        ForestSlasher.ProviderScore[] memory provScores = new ForestSlasher.ProviderScore[](2);
        provScores[0] = ForestSlasher.ProviderScore(1, 2, 0);
        provScores[1] = ForestSlasher.ProviderScore(2, 3, 1);

        ForestSlasher.ProviderScore[] memory provScores2 = new ForestSlasher.ProviderScore[](2);
        provScores2[0] = ForestSlasher.ProviderScore(1, 22, 0);
        provScores2[1] = ForestSlasher.ProviderScore(2, 8, 1);
        
        // Get the contract instance
        ForestSlasher slasher = ForestSlasher(address(iForestSlasher));
        bytes32 commitHash1 = slasher.computeHash(provScores); 
        bytes32 commitHash2 = slasher.computeHash(provScores2);
        slasher.reveal(commitHash1, val1Addr, PT1_ADDR, provScores);
        slasher.reveal(commitHash2, val1Addr, PT2_ADDR, provScores2);
        console2.log("Results revealed");
        vm.stopBroadcast();
    }

    function emitRewards() public {
        vm.startBroadcast(ptoPrivKey);
        console2.log("block.number", block.number);
        console2.log("Emitting rewards");
        iForestToken.emitRewards(iForestSlasher.getCurrentEpochEndBlockNum()-iForestSlasher.EPOCH_LENGTH());
        vm.stopBroadcast();
    }
}