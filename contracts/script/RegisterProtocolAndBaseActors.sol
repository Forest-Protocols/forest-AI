pragma solidity ^0.8.22;

// forge script script/RegisterProtocolAndBaseActors.sol:RegisterProtocolAndBaseActors --rpc-url 127.0.0.1:8545 --broadcast
// forge script script/RegisterProtocolAndBaseActors.sol:RegisterProtocolAndBaseActors --sig "enterAgreement(address)" 0x6D544390Eb535d61e196c87d6B9c80dCD8628Acd --rpc-url 127.0.0.1:8545 --broadcast

// forge script script/RegisterProtocolAndBaseActors.sol:RegisterProtocolAndBaseActors --chain 84532 --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast
// forge script script/RegisterProtocolAndBaseActors.sol:RegisterProtocolAndBaseActors --chain 84532 --rpc-url $BASE_SEPOLIA_RPC_URL --sig "enterAgreement(address)" $PROTOCOL_ADDR_FSP --broadcast

// forge script script/RegisterProtocolAndBaseActors.sol:RegisterProtocolAndBaseActors --chain 11155420 --rpc-url $OP_SEPOLIA_RPC_URL --broadcast
// forge script script/RegisterProtocolAndBaseActors.sol:RegisterProtocolAndBaseActors --chain 11155420 --rpc-url $OP_SEPOLIA_RPC_URL --sig "enterAgreement(address)" $PROTOCOL_ADDR_FSP --broadcast

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import "@openzeppelin/contracts/interfaces/IERC20Metadata.sol";

import "../src/ForestCommon.sol";

import {IForestRegistry} from "../src/interfaces/IForestRegistry.sol";
import {IForestSlasher} from "../src/interfaces/IForestSlasher.sol";
import {IForestProtocol} from "../src/interfaces/IForestProtocol.sol";
import {IForestToken} from "../src/interfaces/IForestToken.sol";

contract RegisterProtocolAndBaseActors is Script {
    uint256 runOn = vm.envUint("RUN_ON");

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

    uint public MAX_VALS_NUM = vm.envUint("MAX_VALS_NUM_FSP");
    uint public MAX_PROVS_NUM = vm.envUint("MAX_PROVS_NUM_FSP");
    uint public MIN_COLLATERAL = vm.envUint("MIN_COLLATERAL_FSP");
    uint public VAL_REG_FEE = vm.envUint("VAL_REG_FEE_FSP") * 10**18;
    uint public PROV_REG_FEE = vm.envUint("PROV_REG_FEE_FSP") * 10**18;
    uint public OFFER_REG_FEE = vm.envUint("OFFER_REG_FEE_FSP") * 10**18;
    uint public TERM_UPDATE_DELAY = vm.envUint("TERM_UPDATE_DELAY_FSP");
    uint public PROV_SHARE = vm.envUint("PROV_SHARE_FSP");
    uint public VAL_SHARE = vm.envUint("VAL_SHARE_FSP");
    uint public PT_OWNER_SHARE = vm.envUint("PT_OWNER_SHARE_FSP");
    uint public FEE_USDC = vm.envUint("FEE_USDC_FSP");

    uint256 ptoPrivKey = vm.envUint("PRIV_KEY_PTO_FSP");
    address ptoAddr = vm.addr(ptoPrivKey);
    uint256 prov1PrivKey = vm.envUint("PRIV_KEY_PROV1_FSP");
    address prov1Addr = vm.addr(prov1PrivKey);
    uint256 val1PrivKey = vm.envUint("PRIV_KEY_VAL1_FSP");
    address val1Addr = vm.addr(val1PrivKey);
    uint256 user1PrivKey = vm.envUint("PRIV_KEY_USER1_FSP");
    address user1Addr = vm.addr(user1PrivKey);
    
    string public PTO_DETAILS_LINK = vm.envString("PTO_DETAILS_LINK_FSP");
    string public PROV_DETAILS_LINK = vm.envString("PROV1_DETAILS_LINK_FSP");
    string public OFFER_DETAILS_LINK = vm.envString("OFFER_DETAILS_LINK_FSP");
    string public PC_DETAILS_LINK = vm.envString("PT_DETAILS_LINK_FSP");
    string public VAL_DETAILS_LINK = vm.envString("VAL1_DETAILS_LINK_FSP");

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
            usdcTokenAddr = vm.envAddress("LOCAL_USDC_TOKEN_ADDRESS");
            forestTokenAddr = vm.envAddress("LOCAL_FOREST_TOKEN_ADDRESS");
            slasherAddr = vm.envAddress("LOCAL_SLASHER_ADDRESS");
            registryAddr = vm.envAddress("LOCAL_REGISTRY_ADDRESS");
        } else if (runOn == 1) {
            // 1 - op sepolia
            privKey = vm.envUint("BASE_SEPOLIA_PRIV_KEY");
            keyAddr = vm.addr(privKey);
            usdcTokenAddr = vm.envAddress("BASE_SEPOLIA_USDC_TOKEN_ADDRESS");
            forestTokenAddr = vm.envAddress("BASE_SEPOLIA_FOREST_TOKEN_ADDRESS");
            slasherAddr = vm.envAddress("BASE_SEPOLIA_SLASHER_ADDRESS");
            registryAddr = vm.envAddress("BASE_SEPOLIA_REGISTRY_ADDRESS");
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
         // Actor Sample Deploy Params
        uint INITIAL_COLLATERAL = MIN_COLLATERAL;

        fundAccountWithToken(privKey, ptoAddr, ptoPrivKey, 10000);
        fundAccountWithToken(privKey, prov1Addr, prov1PrivKey, 10000);
        fundAccountWithToken(privKey, val1Addr, val1PrivKey, 10000);
        fundAccountWithToken(privKey, user1Addr, user1PrivKey, 10000);

        // register a protocol owner
        vm.startBroadcast(ptoPrivKey);
        console2.log("Registering protocol owner");
        iForestRegistry.registerActor(ForestCommon.ActorType.PT_OWNER, address(0), address(0), PTO_DETAILS_LINK);
        // register a protocol 
        console2.log("Creating protocol");
        address protocolAddr = iForestRegistry.createProtocol(MAX_VALS_NUM, MAX_PROVS_NUM, MIN_COLLATERAL, VAL_REG_FEE, PROV_REG_FEE, OFFER_REG_FEE, TERM_UPDATE_DELAY, PROV_SHARE, VAL_SHARE, PT_OWNER_SHARE, PC_DETAILS_LINK);
        console2.log("Protocol created at address %s", protocolAddr);
        IForestProtocol protocol = IForestProtocol(protocolAddr);
        vm.stopBroadcast();
        
        // register a provider in the network
        console2.log("Registering provider 1 with address %s", prov1Addr);
        vm.startBroadcast(prov1PrivKey);
        iForestRegistry.registerActor(ForestCommon.ActorType.PROVIDER, address(0), address(0), PROV_DETAILS_LINK);
        // register a provider in a protocol
        console2.log("Registering provider 1 in protocol 1");
        protocol.registerActor(ForestCommon.ActorType.PROVIDER, INITIAL_COLLATERAL);
        // register an offer
        console2.log("Registering offer in protocol");
        uint32 offerId = protocol.registerOffer(
            prov1Addr,
            FEE_USDC,
            1000,
            OFFER_DETAILS_LINK
        );
        address offerAddr = protocol.getOffer(offerId).ownerAddr;
        console2.log("Offer registered in protocol 1 under provider address %s", offerAddr);
        vm.stopBroadcast();

        // register a validator
        vm.startBroadcast(val1PrivKey);
        iForestRegistry.registerActor(ForestCommon.ActorType.VALIDATOR, address(0), address(0), VAL_DETAILS_LINK);
        // register a validator in a protocol
        protocol.registerActor(ForestCommon.ActorType.VALIDATOR, INITIAL_COLLATERAL);
        vm.stopBroadcast();
    }

    function enterAgreement(address _protocolAddress, uint8 _count) public {
        console2.log("User address: %s", user1Addr);
        console2.log("Protocol address: %s", _protocolAddress);
        console2.log("Entering agreement");
        IForestProtocol protocol = IForestProtocol(_protocolAddress);

        vm.startBroadcast(user1PrivKey);
        // approve the protocol to spend the user's tokens
        for (uint8 i = 0; i < _count; i++) {
            iUsdcToken.approve(address(protocol), type(uint256).max);
            // enter an agreement wtih prov1
            uint256 fee = protocol.getOffer(0).fee;
            uint32 agreementId = protocol.enterAgreement(0, 2 * 2635200 * fee);
            console2.log("Agreement with id %s entered with prov1", agreementId);
        }
        vm.stopBroadcast();
    }
}