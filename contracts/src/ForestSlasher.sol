// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

import "./interfaces/IForestProtocol.sol";
import "./interfaces/IForestRegistry.sol";

contract ForestSlasher is Ownable, Pausable {
    /***********************************|
    |              Events               |
    |__________________________________*/

    // TODO: add an EpochClosed event
    
    event CommitSubmitted(  
        bytes32 hashValue,
        uint24 indexed valId,
        address indexed ptAddr,
        string detailsLink
    );
    
    event CommitRevealed(
        bytes32 hashValue
    );

    event ActorCollateralTopuped(
        address indexed actorAddr,
        uint256 amount
    );

    event ActorCollateralWithdrawn(
        address indexed actorAddr,
        uint256 amount
    );

    /***********************************|
    |          Structs & Enums          |
    |__________________________________*/

    enum CommitStatus {
        NONE,
        COMMITED,
        REVEALED
    }

    struct ProviderScore {
        uint24 provId; // we are using IDs to save on space, 24 bits vs 20*8 bits
        uint256 score; // TODO: limit the size to 16bits to prevent overflows when aggregating, allow for negative scores for slashing implementation
        uint32 agreementId; 
    }

    struct EpochScoreGranular {
        uint24 valId; // we are using IDs to save on space, 24 bits vs 20*8 bits
        ProviderScore[] provScores;
        bytes32 commitHash;
        CommitStatus status;
    }

    struct EpochScoreAggregate {
        address ptAddr;
        uint256 revenueAtEpochClose;
        uint256[2][] provRanks; // the tuple is (providerId, aggregatedScore) or (providerId, rank)
        uint256[2][] valRanks; // the tuple is (validatorId, diviationScore) or (validatorId, rank)
    }

    /***********************************|
    |            Variables              |
    |__________________________________*/

    IERC20 public forestToken; // Interface object for the Forest token
    IForestRegistry public registry; // Interface object for the Registry contract

    mapping(address => mapping(address => uint256)) actorCollateralBalanceOf; // mapping of PT address to Provider address to deposited token amount on this PT

    uint256 firstEpochEndBlockNum; // Block number when the first epoch ends
    uint256 currentEpochEndBlockNum; // Block number when the currently processed epoch ends
    address[] currentPtAddresses; // array of addresses to which at least one commit has been submitted
    mapping(address => bool) currentPtAddressesMap; // mapping to check uniqueness before adding to the array
    mapping(address => EpochScoreGranular[]) currentPtToEpochScoreMap; // mapping from Protocol address to array of EpochScoreGranular objects
    mapping(bytes32 => uint256) currentHashToIndexMap; // mapping from hash to index that can be used to access EpochScoreGranular objects from the currentPtToEpochScoreMap if we have the Protocol address

    // helper variables for aggregateScores calculations, cleared after each aggregation is complete
    mapping(uint24 => uint256) actorIdToAggregateScore; // mapping from actor ID to aggregated score
    uint256[2][] provIdToScore; // array of tuples (providerId, aggregatedScore)
    uint256[2][] provIdToTestNum; // array of tuples (providerId, number of tests)
    uint256[2][] valIdToTestNum; // array of tuples (validatorId, number of tests)
    uint24[] uniqueActors; // array of unique Actor IDs
    
    mapping(uint256 => EpochScoreAggregate[]) epochToAggregatedScoreMap; // mapping from Epoch to struct with Protocol address and Val/Prov ranks

    /// @dev EPOCH_LENGTH must always be set to a greater value than REVEAL_WINDOW
    // uint256 public constant EPOCH_LENGTH = 302400; // a week on Optimism that has 2 sec block time
    // uint256 public constant REVEAL_WINDOW = 43200; // one day on Optimism
    uint256 public EPOCH_LENGTH = 1800; // TODO: JUST FOR TESTING: an hour on Optimism that has 2 sec block time
    uint256 public REVEAL_WINDOW = 300; //// TODO: JUST FOR TESTING:  10min on Optimism

    /***********************************|
    |            Constructor            |
    |__________________________________*/

    constructor() Ownable(_msgSender()) { 
         currentEpochEndBlockNum = computeCurrentEpochEndBlockNum();
         firstEpochEndBlockNum = currentEpochEndBlockNum;
    }

    /// @notice Sets the Registry interface object based on the provided address and uses the Registry contract to lookup and set the Forest token interface object
    /// @dev Can only be called by the Owner
    /// @param _registryAddr Address of the Registry contract
    function setRegistryAndForestAddr(address _registryAddr) external onlyOwner {
        if (_registryAddr == address(0))
            revert ForestCommon.InvalidAddress();
        registry = IForestRegistry(_registryAddr);
        forestToken = IERC20(registry.getForestTokenAddr());
    }

    /***********************************|
    |        Slasher Functions          |
    |__________________________________*/

    /// @notice Commits Validator's scores hash for a PT in the current epoch. Commitments are made during a voting window.
    /// @dev Validators must commit their scores before revealing them to prevent manipulation
    /// @param _commitHash Hash of the Provider scores
    /// @param _valAddr Address of the Validator to whom the commitment belongs
    /// @param _ptAddr Address of the PT being scored
    function commit(bytes32 _commitHash, address _valAddr, address _ptAddr, string memory _detailsLink) public whenNotPaused {
        onlyWhenRegistryAndTokenSet();
        IForestProtocol pt = getCheckedPt(_ptAddr);
        // check if the previous epochs are closed
        if (computeCurrentEpochEndBlockNum() > currentEpochEndBlockNum)
            revert ForestCommon.InvalidState();
        // check if commitment is not already submitted
        if (currentPtToEpochScoreMap[_ptAddr].length > 0 && currentPtToEpochScoreMap[_ptAddr][currentHashToIndexMap[_commitHash]].commitHash == _commitHash)
            revert ForestCommon.CommitmentAlreadySubmitted();
        // check if _msgSender() is a representative of a registered active Validator
        if (!pt.isActiveRegisteredAndAuthorizedRepresentative(ForestCommon.ActorType.VALIDATOR, _valAddr, _msgSender()))
            revert ForestCommon.OnlyOwnerOrOperatorAllowed();
        
        uint24 valId = registry.getActor(_valAddr).id;

        // create the object commited object
        EpochScoreGranular memory granularScore = EpochScoreGranular(
            valId,
            new ProviderScore[](1),
            _commitHash,
            CommitStatus.COMMITED
        );

        // update global state
        if (!currentPtAddressesMap[_ptAddr]) {
            currentPtAddresses.push(_ptAddr);
            currentPtAddressesMap[_ptAddr] = true;
        }
        currentPtToEpochScoreMap[_ptAddr].push(granularScore);
        currentHashToIndexMap[_commitHash] = currentPtToEpochScoreMap[_ptAddr].length - 1;
        
        // emit event
        emit CommitSubmitted(
            _commitHash,
            valId,
            _ptAddr,
            _detailsLink
        );
    }

    /// @notice Reveals previously committed scores for Providers
    /// @dev Can only be called during the reveal window after epoch end
    /// @param _commitHash Hash that was previously committed
    /// @param _valAddr Validator address to whom the commitment belongs
    /// @param _ptAddr PT address being scored
    /// @param _provScores Array of Provider scores being revealed that after hashing produce the _commitHash
    function reveal(bytes32 _commitHash, address _valAddr, address _ptAddr, ProviderScore[] memory _provScores) public whenNotPaused {
        onlyWhenRegistryAndTokenSet();
        // check if the reveal is not too early or too late
        if (block.number <= currentEpochEndBlockNum || block.number > currentEpochEndBlockNum + REVEAL_WINDOW)
            revert ForestCommon.InvalidState();
        // validate protocol based on call arg
        IForestProtocol pt = getCheckedPt(_ptAddr);
        // check if hash exists and has relevant status
        EpochScoreGranular storage granularScore = currentPtToEpochScoreMap[_ptAddr][currentHashToIndexMap[_commitHash]];
        if(granularScore.status != CommitStatus.COMMITED)
            revert ForestCommon.InvalidState();
        // check if this commitment belongs to the _valAddr
        if(granularScore.valId != registry.getActor(_valAddr).id)
            revert ForestCommon.Unauthorized();
        // check if _msgSender() is a representative of a registered active Validator
        if (!pt.isActiveRegisteredAndAuthorizedRepresentative(ForestCommon.ActorType.VALIDATOR, _valAddr, _msgSender()))
            revert ForestCommon.OnlyOwnerOrOperatorAllowed();

        // check if hashes add up
        bytes32 computedHash = computeHash(_provScores);
        if (_commitHash != computedHash)
            revert ForestCommon.InvalidState();

        for (uint i = 0; i < _provScores.length; i++) {
            // check if agreementId exists
            ForestCommon.Agreement memory agreement = pt.getAgreement(_provScores[i].agreementId);
            
            if (agreement.status == ForestCommon.Status.NONE)
                revert ForestCommon.ObjectNotActive();
            // check if agreement points to Provider address
            if (registry.getActor(pt.getOffer(agreement.offerId).ownerAddr).id != _provScores[i].provId)
                revert ForestCommon.ProviderDoesNotMatchAgreement(_provScores[i].provId, agreement.id);
            // check if agreement userAddr is equal to _msgSender() or _valAddr
            if (agreement.userAddr != _msgSender() && agreement.userAddr != _valAddr)
                revert ForestCommon.ValidatorDoesNotMatchAgreement(granularScore.valId , agreement.id);
            // TODO: check if the score for an agreement or offer hasn't been revealed already (no-multiple test/reveals on the same agreement/offer)
        }

        // save
        granularScore.provScores = _provScores;
        granularScore.status = CommitStatus.REVEALED;

        emit CommitRevealed(_commitHash);
    }

    /// @notice Closes the currently processed epoch and aggregates all revealed scores as well as computes scores for validators
    /// @dev Can only be called after the reveal window has ended
    function closeEpoch() public whenNotPaused returns (uint256 closedEpochNum) {
        onlyWhenRegistryAndTokenSet();
        // check if the close is not too early 
        // TODO: possible small vulnerability - if not closed soon after corresponding reveal window is closed then the data on activeAgreementValue is getting the more out-of-date the later the close is happening. Not big though
        if (block.number <= currentEpochEndBlockNum + REVEAL_WINDOW) 
            revert ForestCommon.InvalidState();
        
        // aggregate scores in each Protocol and save in epochToAggregatedScoreMap
        closedEpochNum = currentEpochEndBlockNum;
        epochToAggregatedScoreMap[currentEpochEndBlockNum] = aggregateScores(); // TODO: possibly call off-chain zk computation engine

        // reset relevant variables
        // step 1: clear global simple vars
        currentEpochEndBlockNum = computeCurrentEpochEndBlockNum();

        // step 2: clear mappings: currentPtToEpochScoreMap, currentHashToIndexMap, currentPtAddressesMap
        for (uint256 i = 0; i < currentPtAddresses.length; i++) {
            address ptAddr = currentPtAddresses[i];

            // clear currentHashToIndexMap entries for each EpochScoreGranular
            EpochScoreGranular[] storage epochScores = currentPtToEpochScoreMap[ptAddr];
            for (uint256 j = 0; j < epochScores.length; j++) {
                bytes32 commitHash = epochScores[j].commitHash;
                delete currentHashToIndexMap[commitHash];
            }

            // clear the EpochScoreGranular array for the Protocol address
            delete currentPtToEpochScoreMap[ptAddr];

            // clear mapping used for uniqueness check
            delete currentPtAddressesMap[ptAddr];
        }

        // step 3: clear: currentPtAddresses
        delete currentPtAddresses;

        return closedEpochNum;
    }

    /// @notice Clears temporary data structures used in score aggregation
    /// @dev Internal function called after aggregation is complete
    function clearAggregateScoresHelpers() internal {
        for (uint24 i = 0; i < uniqueActors.length; i++) 
            delete actorIdToAggregateScore[uniqueActors[i]];
        delete provIdToScore;
        delete provIdToTestNum;
        delete valIdToTestNum;
        delete uniqueActors;
    }

    /// @notice Calculates aggregate weighted scores for providers and validators across all protocols.
    /// @dev Used internally in closeEpoch()
    /// @return Array of aggregated scores for each protocol
    function aggregateScores() public returns (EpochScoreAggregate[] memory) {
        address[] memory ptAddrs = registry.getAllPtAddresses();
        EpochScoreAggregate[] memory aggregates = new EpochScoreAggregate[](ptAddrs.length);

        for (uint256 i = 0; i < ptAddrs.length; i++) {
            address ptAddr = ptAddrs[i];
            IForestProtocol pt = IForestProtocol(ptAddr);

            // iterate through all the epoch scores for this Protocol address and provide scores within each epoch score
            EpochScoreGranular[] memory epochScores = currentPtToEpochScoreMap[ptAddr];
            // if there are no commits, save empty object for this Protocol
            if (epochScores.length != 0) {
                // initialize the arrays with first entry so it's easier to properly find indexes using mapping (non-existant entry in array will return 0 index, so we don't want to use it)
                provIdToScore.push([0,0]);
                provIdToTestNum.push([0,0]);
                valIdToTestNum.push([0,0]);
                uniqueActors.push(0);

                for (uint256 j = 0; j < epochScores.length; j++) {
                    // take into account only Revealed commits
                    if (epochScores[j].status != CommitStatus.REVEALED)
                        continue;
                    for (uint256 k = 0; k < epochScores[j].provScores.length; k++) {
                        uint256 index = actorIdToAggregateScore[epochScores[j].provScores[k].provId];
                        if (index == 0) {
                            provIdToScore.push([epochScores[j].provScores[k].provId, epochScores[j].provScores[k].score]);
                            provIdToTestNum.push([epochScores[j].provScores[k].provId, 1]);
                            actorIdToAggregateScore[epochScores[j].provScores[k].provId] = provIdToScore.length - 1;
                            uniqueActors.push(epochScores[j].provScores[k].provId);
                        } else {
                            provIdToScore[index][1] += epochScores[j].provScores[k].score;
                            provIdToTestNum[index][1] += 1;
                        }

                        index = actorIdToAggregateScore[epochScores[j].valId];
                        // TODO: add fee weights to validator score calculations to account for difference in costs for testing different offers that cost different amount of money
                        if (index == 0) {
                            valIdToTestNum.push([epochScores[j].valId, 1]);
                            actorIdToAggregateScore[epochScores[j].valId] = valIdToTestNum.length - 1;
                            uniqueActors.push(epochScores[j].valId);
                        } else {
                            valIdToTestNum[index][1] += 1;
                        }
                    }
                }

                // once the summation is complete, 1) substitute the 0-indexed fillers with last elements of each of the array and 2) take an average of the Provider scores
                // step 1)
                provIdToScore[0] = provIdToScore[provIdToScore.length - 1];
                provIdToScore.pop();
                provIdToTestNum[0] = provIdToTestNum[provIdToTestNum.length - 1];
                provIdToTestNum.pop();
                valIdToTestNum[0] = valIdToTestNum[valIdToTestNum.length - 1];
                valIdToTestNum.pop();
                uniqueActors[0] = uniqueActors[uniqueActors.length - 1];
                uniqueActors.pop();

                // step 2)
                for (uint256 j = 0; j < provIdToScore.length; j++) {
                    if (provIdToTestNum[j][1] == 0) {
                        provIdToScore[j][1] = 0;
                    } else {
                        provIdToScore[j][1] = provIdToScore[j][1] / provIdToTestNum[j][1];
                    }
                }
            }
            
            aggregates[i] = EpochScoreAggregate(ptAddr, pt.getActiveAgreementsValue(), provIdToScore, valIdToTestNum);
            clearAggregateScoresHelpers();
        }
        return aggregates;
    }

    /// @notice Checks whether the Protocol is registered in the Registry contract and active
    /// @param _ptAddr Address of the Protocol to check
    /// @return The Protocol interface if valid
    function getCheckedPt(address _ptAddr) internal view returns (IForestProtocol) {
        IForestProtocol pt = IForestProtocol(_ptAddr);
        if (!registry.isPtRegisteredAndActive(_ptAddr))
            revert ForestCommon.ObjectNotActive();
        return pt;
    }

    /// @notice Allows actors to deposit collateral for a specific PT
    /// @dev Collateral is required for Providers and Validators to participate. Since the caller can be a Protocol during Actor registration, we can't simply use _msgSender. Can be called only by the Owner of the actor. Not an Operator.
    /// @param _ptAddr Address of the PT
    /// @param _actorType Type of actor (Provider or Validator)
    /// @param _sender Owner address of the actor for which collateral is being deposited
    /// @param _amount Amount of collateral to deposit
    function topupActorCollateral(
        address _ptAddr,
        ForestCommon.ActorType _actorType,
        address _sender,
        uint256 _amount
    ) public whenNotPaused {
        onlyWhenRegistryAndTokenSet();
        IForestProtocol pt = getCheckedPt(_ptAddr);
        // if the sender is not the Protocol itself, then the sender must be a registered, owner actor
        if (_msgSender() != _ptAddr && !(pt.isActiveRegisteredOwner(_actorType, _sender) && _sender == _msgSender()))
            revert ForestCommon.Unauthorized();

        // transfer tokens
        forestToken.transferFrom(_sender, address(this), _amount);

        // update the balance
        actorCollateralBalanceOf[_ptAddr][_sender] += _amount;

        emit ActorCollateralTopuped(_sender, _amount);
    }

    /// @notice Allows actors to withdraw their collateral
    /// @dev Can only withdraw if remaining amount meets minimum collateral requirement. Can be called only by the Owner of the actor. Operator not allowed.
    /// @param _ptAddr Address of the PT
    /// @param _actorType Type of actor (Provider or Validator)
    /// @param _amount Amount of collateral to withdraw
    function withdrawActorCollateral(
        address _ptAddr,
        ForestCommon.ActorType _actorType,
        uint256 _amount
    ) public whenNotPaused {
        onlyWhenRegistryAndTokenSet();
        IForestProtocol pt = getCheckedPt(_ptAddr);
        if (!pt.isActiveRegisteredOwner(_actorType, _msgSender()))
            revert ForestCommon.OnlyOwnerAllowed();
        // TODO: possibly we should add a termsUpdateDelay-based logic

        uint256 currentCollateral = actorCollateralBalanceOf[_ptAddr][ _msgSender()];
 
        if (currentCollateral - _amount < pt.getMinCollateral())
            revert ForestCommon.InsufficientAmount();
        
        actorCollateralBalanceOf[_ptAddr][_msgSender()] -= _amount;
        
        forestToken.transfer(_msgSender(), _amount);
        
        emit ActorCollateralWithdrawn(_msgSender(), _amount);
    }

    /***********************************|
    |      OZ Pausable Related          |
    |__________________________________*/

    /// @notice Pauses the contract
    function pause() external onlyOwner() {
        _pause();
    }

    /// @notice Unpauses the contract
    function unpause() external onlyOwner() {
        _unpause(); 
    }

    /***********************************|
    |         Helper Functions          |
    |__________________________________*/

    /// @notice Computes hash of Provider scores for commitment
    /// @dev Used to create commitment hash before revealing scores
    /// @param _provScores Array of Provider scores to hash
    /// @return Hash of the encoded Provider scores
    function computeHash(ProviderScore[] memory _provScores) public pure returns (bytes32) {
        return keccak256(abi.encode(_provScores));
    }

    /// @notice Calculates the block number when current epoch ends
    /// @dev Uses constant EPOCH_LENGTH to determine epoch boundaries
    /// @return Block number when current epoch ends
    function computeCurrentEpochEndBlockNum() public view returns (uint256) {
        return block.number - (block.number % EPOCH_LENGTH) + EPOCH_LENGTH;
    }

    /// @notice Validates if a given block number is a valid epoch end
    /// @dev Checks if block number aligns with epoch length and is after first epoch
    /// @param _epochEndBlockNum Block number to validate
    /// @return True if block number is valid epoch end
    function isValidEpochEndBlockNum(uint256 _epochEndBlockNum) public view returns (bool) {
        return (_epochEndBlockNum % EPOCH_LENGTH == 0) && _epochEndBlockNum >= firstEpochEndBlockNum;
    }

    /// @notice Ensures that the registry and forest contracts are set
    function onlyWhenRegistryAndTokenSet() public view {
        if (address(registry) == address(0) || address(forestToken) == address(0))
            revert ForestCommon.InvalidAddress();
    }

    /***********************************|
    |         Getter Functions          |
    |__________________________________*/

    /// @notice Gets the collateral balance of an actor for a specific PT
    /// @param _ptAddr Address of the PT
    /// @param _addr Owner address of the actor to get the collateral balance for
    /// @return collateralBalance Collateral balance of the given actor for the specified PT
    function getCollateralBalanceOf(address _ptAddr, address _addr) external view returns (uint256) {
        return actorCollateralBalanceOf[_ptAddr][_addr];
    }

    /// @notice Gets the block number when the currently processed epoch ends
    /// @return currentEpochEndBlockNum Block number when the currently processed epoch ends
    function getCurrentEpochEndBlockNum() external view returns (uint256) {
        return currentEpochEndBlockNum;
    }

    /// @notice Gets the granular scores for a specific PT for the currently processed epoch
    /// @param _ptAddr Address of the PT
    /// @return epochScores Granular scores for the specified PT for the currently processed epoch
    function getEpochScoresGranular(address _ptAddr) external view returns (EpochScoreGranular[] memory) {
        return currentPtToEpochScoreMap[_ptAddr];
    }

    /// @notice Gets the index of a commit hash
    /// @param _commitHash Commit hash to get the index for
    /// @return index Index of the commit hash
    function getHashToIndex(bytes32 _commitHash) external view returns (uint256) {
        return currentHashToIndexMap[_commitHash];
    }

    /// @notice Gets the aggregated scores for all PTs for a specific epoch
    /// @param _epoch Epoch number to get the aggregated scores for
    /// @return aggregatedScores Aggregated scores for all PTs for the specified epoch
    function getEpochScoresAggregate(uint256 _epoch) external view returns (EpochScoreAggregate[] memory) {
        return epochToAggregatedScoreMap[_epoch];
    }

}
