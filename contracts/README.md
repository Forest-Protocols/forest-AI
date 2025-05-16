# Forest Network - Smartcontracts
## High-level View
This is Forest Network Smartcontracts. This suite of modularised immutable code is divided up into four contracts which govern the following main areas of concern:
- **ForestRegistry** contract: reponsible for keeping track of all actor registrations, Protocols (including spinning up new ones) and collecting registration fees;
- **ForestProtocol** contract: responsible for a single Forest Network Protocol (PT) specific logic of enforcing PT rules and facilitating Providers entering Agreements with Users. Includes logic for processing Agreement balances and fees;
- **ForestSlasher** contract: responsible for managing Actor's collateral, accepting votes from Validators on Provider's performance and aggregating the granular scores into aggregates which are used subsequently in emissions and slashing processes; 
- **ForestToken** contract: responsible for calculating and emitting new FOREST tokens based on info from Slasher as well as supporting typical ERC-20 functionality like transfers, burning and approvals.

## How to Interact with the Protocol
There are three main ways to interact with the Protocol:
1. CLI: [link to npm](https://www.npmjs.com/package/@forest-protocols/cli)
2. Etherscan: check out the "Current live deployments" section below for explorer links to verified contracts
3. Marketplace Web App by Forest Protocols: work-in-progress

For test tokens:
- USDC: https://faucet.circle.com/
- FOREST: contact the team on [Discord](https://discord.gg/HWm96wKzWV)

## Code-level Assumptions
1. Order of deployment is important:
- new ForestToken()
- new ForestSlasher()
- new ForestRegistry() 
- slasher.setRegistryAndForestAddr(address(registry)) 
- forestToken.setRegistryAndSlasherAddr(address(registry))
2. An address can register only as one type of actor both on the Network level and on the PTs level.
3. The PT smartcontracts are functional with the assumption that they were deployed by the ForestRegistry contract. Standalone deployment of PT code is not supported.
4. Collateral related functions can only be called by the Owner address, not the Operator address.

## Installation and Config

- Install foundry: [link](https://book.getfoundry.sh/getting-started/installation)
- Clone repo
- Change .env.example to .env and fill all the required fields
- Might need `forge install Openzeppelin/openzeppelin-contracts-upgradeable --no-commit` and `forge install Openzeppelin/openzeppelin-contracts --no-commit`

## Useful Commands

- Compile: `forge build`
- Run tests with detailed logging: `forge test -vvvv`
- Update env vars in `.env`
- Load env vars from file `source .env`
- Run scripts 
    - e.g. deployment for Base Sepolia: `forge script --chain 84532 script/DeployForestContracts.sol:DeployScript --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast --verify --etherscan-api-key $BASE_SEPOLIA_API_KEY -vvvv` (env vars: RUN_ON set to 1, BASE_SEPOLIA_PRIV_KEY filled out)
    - deployment on local Anvil: `forge script script/DeployForestContracts.sol:DeployScript --rpc-url 127.0.0.1:8545 --broadcast` (env vars: RUN_ON set to 0, LOCAL_PRIV_KEY filled out)
- (Generate interface from ABI: `cast interface -n IForestRegistry utils/ForestRegistry.abi > IForestRegistry.sol`)

## Instructions for Minimal Anvil Deployment for Testing

This will produce a network with two protocols, each with two providers and one validator as well as two closed epochs and one rewards emission event.

Prerequisite:
* change ForestSlasher values for epoch length and reveal window
    ```
    uint256 public EPOCH_LENGTH = 10; 
    uint256 public REVEAL_WINDOW = 4; 
    ```

Steps:

1. `source .env` 
2. `forge script script/DeployForestContracts.sol:DeployScript --rpc-url 127.0.0.1:8545 --broadcast`
3. update `.env` file with contract addresses (registry, token, mockedusdc, slasher) 
4. `source .env` 
5. `forge script script/MinimalAnvilTestDeployment.sol:MinimalAnvilTestDeployment --rpc-url 127.0.0.1:8545 --broadcast`
6. update `address public constant PT1_ADDR = ...` and `address public constant PT2_ADDR = ...` in `script/MinimalAnvilTestDeployment.sol`file with deployed protocol addresses (see addresses in logs from execution of the last command)
7. `forge script script/MinimalAnvilTestDeployment.sol:MinimalAnvilTestDeployment --sig "enter2AgreementsAsValidator()" --rpc-url 127.0.0.1:8545 --broadcast`
8. `forge script script/MinimalAnvilTestDeployment.sol:MinimalAnvilTestDeployment --sig "closeCurrentEpoch" --rpc-url 127.0.0.1:8545 --broadcast`
9. `forge script script/MinimalAnvilTestDeployment.sol:MinimalAnvilTestDeployment --sig "commitResults()" --rpc-url 127.0.0.1:8545 --broadcast`
10. `cast rpc evm_mine` until block 61 
11. `forge script script/MinimalAnvilTestDeployment.sol:MinimalAnvilTestDeployment --sig "revealResults()" --rpc-url 127.0.0.1:8545 --broadcast`
12. `cast rpc evm_mine` until block 65
13. `forge script script/MinimalAnvilTestDeployment.sol:MinimalAnvilTestDeployment --sig "closeCurrentEpoch" --rpc-url 127.0.0.1:8545 --broadcast`
14. `forge script script/MinimalAnvilTestDeployment.sol:MinimalAnvilTestDeployment --sig "emitRewards" --rpc-url 127.0.0.1:8545 --broadcast`

## Current live deployments

### Base Sepolia

[current] 
v0.45 (private purchases via user whitelist, changed events for emissions)
- [dev env] ForestRegistry contract: 0x2F1c43d20E8A99DE2fb4e3375aDd29fbD1e5Eff0: [explorer link](https://sepolia.basescan.org/address/0x2F1c43d20E8A99DE2fb4e3375aDd29fbD1e5Eff0)
- [dev env] ForestSlasher contract: 0x86d45E437238c8aCAD8C37e7D6A4f86C3335d34b: [explorer link](https://sepolia.basescan.org/address/0x86d45E437238c8aCAD8C37e7D6A4f86C3335d34b)
- [dev env] ForestToken contract: 0x7d9A7D5F382E71AaCab227D96B9cd95218E36f30: [explorer link](https://sepolia.basescan.org/address/0x7d9A7D5F382E71AaCab227D96B9cd95218E36f30)
- [dev env] MockedUsdcToken contracts: 0xC80ca08851aE3F9d947eb78E1E2d810556AF1303: [explorer link](https://sepolia.basescan.org/address/0xC80ca08851aE3F9d947eb78E1E2d810556AF1303)
