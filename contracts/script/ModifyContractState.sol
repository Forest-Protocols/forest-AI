// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

// forge script --chain 11155420 script/ModifyContractState.sol:ModifyContractState --rpc-url $OP_SEPOLIA_RPC_URL --broadcast --verify --etherscan-api-key $OP_SEPOLIA_API_KEY -vvvv --with-gas-price
// forge script script/ModifyContractState.sol:ModifyContractState --rpc-url 127.0.0.1:8545 --broadcast

import "@openzeppelin/contracts/interfaces/IERC20Metadata.sol";

import "../src/ForestCommon.sol";
import {IForestRegistry} from "../src/interfaces/IForestRegistry.sol";
import {IForestSlasher} from "../src/interfaces/IForestSlasher.sol";
import {IForestToken} from "../src/interfaces/IForestToken.sol";
import {IForestProtocol} from "../src/interfaces/IForestProtocol.sol";
import {Script, console2} from "forge-std/Script.sol";

contract ModifyContractState is Script {
    uint256 runOn = vm.envUint("RUN_ON");
    uint256 privKey;
    address keyAddr;
    address usdcTokenAddr;
    address forestTokenAddr;
    address slasherAddr;
    address registryAddr;

    IForestRegistry public registry;
    IForestSlasher public slasher;
    IForestToken public forestToken;
    IERC20Metadata public usdcToken;

    function setUp() public {
    }

    function run() public {
     
        privKey = vm.envUint("OP_SEPOLIA_PRIV_KEY");
        keyAddr = vm.addr(privKey);

        usdcTokenAddr = vm.envAddress("OP_SEPOLIA_MOCKED_USDC_TOKEN_ADDRESS");
        forestTokenAddr = vm.envAddress("OP_SEPOLIA_FOREST_TOKEN_ADDRESS");
        slasherAddr = vm.envAddress("OP_SEPOLIA_SLASHER_ADDRESS");
        registryAddr = vm.envAddress("OP_SEPOLIA_REGISTRY_ADDRESS");
        
        usdcToken = IERC20Metadata(usdcTokenAddr);
        registry =  IForestRegistry(registryAddr);
        slasher = IForestSlasher(slasherAddr);
        forestToken = IForestToken(forestTokenAddr);

        vm.startBroadcast(privKey);

        console2.log("Account address: ", keyAddr);
        console2.log("Balance of deployer: ", keyAddr.balance);

        console2.log("before usdcTokenAddr: ", registry.getUsdcTokenAddr());
        registry.setUsdcTokenAddress(usdcTokenAddr);
        console2.log("after usdcTokenAddr: ", registry.getUsdcTokenAddr());
    }
}