set the below values in src/ForestSlasher.sol
uint256 public EPOCH_LENGTH = 10;
uint256 public REVEAL_WINDOW = 4; 

forge script script/DeployForestContracts.sol:DeployScript --rpc-url 127.0.0.1:8545 --broadcast
forge script script/RegisterProtocolBaseActorsAndReportRanks.sol:RegisterProtocolBaseActorsAndReportRanks --rpc-url 127.0.0.1:8545 --broadcast
forge script script/RegisterProtocolBaseActorsAndReportRanks.sol:RegisterProtocolBaseActorsAndReportRanks --sig "enter2AgreementsAsValidator()" --rpc-url 127.0.0.1:8545 --broadcast
forge script script/RegisterProtocolBaseActorsAndReportRanks.sol:RegisterProtocolBaseActorsAndReportRanks --sig "closeCurrentEpoch" --rpc-url 127.0.0.1:8545 --broadcast
forge script script/RegisterProtocolBaseActorsAndReportRanks.sol:RegisterProtocolBaseActorsAndReportRanks --sig "commitResults()" --rpc-url 127.0.0.1:8545 --broadcast
cast rpc evm_mine until block 61 
forge script script/RegisterProtocolBaseActorsAndReportRanks.sol:RegisterProtocolBaseActorsAndReportRanks --sig "revealResults()" --rpc-url 127.0.0.1:8545 --broadcast
cast rpc evm_mine until block 65 
forge script script/RegisterProtocolBaseActorsAndReportRanks.sol:RegisterProtocolBaseActorsAndReportRanks --sig "closeCurrentEpoch" --rpc-url 127.0.0.1:8545 --broadcast
forge script script/RegisterProtocolBaseActorsAndReportRanks.sol:RegisterProtocolBaseActorsAndReportRanks --sig "emitRewards" --rpc-url 127.0.0.1:8545 --broadcast
