// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./interfaces/IForestSlasher.sol";
import "./interfaces/IForestProtocol.sol";
import "./interfaces/IForestRegistry.sol";

contract ForestToken is
    ERC20,
    ERC20Burnable,
    ERC20Pausable,
    Ownable,
    ERC20Permit
{
     /***********************************|
    |              Events               |
    |__________________________________*/

    event RewardsMinted(
        uint256 indexed epoch,
        address indexed ptAddr,
        uint256 revenueAtEpochClose,
        uint256 totalTokensEmitted
    );
    
    /***********************************|
    |            Variables              |
    |__________________________________*/

    // Emission related parameters
    uint256 public constant INITIAL_EMISSION = 50400 ether; // 50400 vs 50 in BTC since adjusted for different block times
    uint256 public constant BLOCK_TIME = 2; // 2 seconds per block on Optimism
    uint256 public constant HALVING_INTERVAL = 63000000; // Bitcoin-like halving interval in blocks (adjusted for different block times)
    uint256 public NO_VALIDATOR_PUNISHMENT_ADJUSTMENT = 7000; // Revenue from Protocols with no Validator reports will be counted only for 70% of its face value
    uint256 public immutable startingBlockNum; // Block number when the contract was deployed
    uint256 lastEmittedEpochBlockNum; // End block number of the last epoch for which rewards were emitted
    uint256 lastEmissionsBlockNum; // Block number when the last emissions were made

    // related contracts
    IForestSlasher slasher; // Slasher contract interface object
    IForestRegistry registry; // Registry contract interface object

    // accounting
    mapping(uint256 => bool) epochRewardsEmittedMap; // Map of epoch numbers to boolean values indicating if rewards have been emitted for that epoch

    /***********************************|
    |            Constructor            |
    |__________________________________*/
    
    constructor(
    ) ERC20("Forest Token", "FOREST") ERC20Permit("Forest Token") Ownable(_msgSender()) {
        // Initial supply distribution
        _mint(msg.sender, 1000000000 * 10 ** decimals());

        startingBlockNum = block.number;
    }

    /// @notice Sets the Registry interface object based on the provided address and uses the Registry contract to lookup and set the Slasher interface object
    /// @dev Available only to the Owner
    /// @param _registryAddr The address of the Registry contract
    function setRegistryAndSlasherAddr(address _registryAddr) public onlyOwner {
        if (_registryAddr == address(0))
            revert ForestCommon.InvalidAddress();
        registry = IForestRegistry(_registryAddr);
        slasher = IForestSlasher(registry.getSlasherAddr());
    }

    /***********************************|
    |          SC Functions             |
    |__________________________________*/

    /// @notice Calculates the current emission amount based on Bitcoin-like halving schedule
    /// @return Current emission amount per epoch after applying halvings
    function calculateCurrentEmissionAmount() public view returns (uint256) {
        uint256 elapsedBlocks = block.number - startingBlockNum;
        uint256 halvings = elapsedBlocks / HALVING_INTERVAL;
        
        return INITIAL_EMISSION >> halvings; // Bitwise shift for halving
    }

    /// @notice Emits token rewards for a completed epoch to Providers, Validators and Protocol Owners based on their performance and Protocol's revenue
    /// @dev Available only when the contract is not paused, when the Registry and Slasher addresses are set, when the epoch is valid and when the epoch is closed and the rewards for this epoch have not been emitted yet
    /// @param _epoch The epoch number for which to emit rewards
    function emitRewards(uint256 _epoch) public whenNotPaused {
        // TODO: possible small vulnerability - if not emitted soon after the epoch is closed then the data on actorTvs is getting the more out-of-date the later the emit is happening. Not big though
        // Validation checks
        onlyWhenRegistryAndSlasherSet();
        if (isRewardEmitted(_epoch))
            revert ForestCommon.EpochRewardAlreadyEmitted();
        if (!slasher.isValidEpochEndBlockNum(_epoch))
            revert ForestCommon.InvalidParam();
        if (_epoch >= slasher.getCurrentEpochEndBlockNum())
            revert ForestCommon.EpochNotClosed();
        
        // Get rankings and calculate emission amount
        ForestSlasher.EpochScoreAggregate[] memory scoresAgregated = slasher.getEpochScoresAggregate(_epoch);
        uint256 totalTokensToEmit = calculateCurrentEmissionAmount();

        // Calculate total revenue for proportional distribution
        uint256 totalRevenue = 0;
        for(uint i = 0; i < scoresAgregated.length; i++) {
            totalRevenue += scoresAgregated[i].provRanks.length > 0 ? scoresAgregated[i].revenueAtEpochClose : scoresAgregated[i].revenueAtEpochClose * NO_VALIDATOR_PUNISHMENT_ADJUSTMENT / ForestCommon.HUNDRED_PERCENT_POINTS;
        }

        uint256 totalTokensEmitted = 0;
        // If there is no revenue, do not emit rewards but mark the epoch as emitted
        if (totalRevenue != 0) {
            // Distribute tokens for each Protocol
            for(uint i = 0; i < scoresAgregated.length; i++) {
                uint256 ptTokensEmitted = 0;

                IForestProtocol pt = IForestProtocol(scoresAgregated[i].ptAddr);
                
                // Calculate tokens for this PT proportional to its revenue
                uint256 ptRevenue = scoresAgregated[i].provRanks.length > 0 ? scoresAgregated[i].revenueAtEpochClose : scoresAgregated[i].revenueAtEpochClose * NO_VALIDATOR_PUNISHMENT_ADJUSTMENT / ForestCommon.HUNDRED_PERCENT_POINTS;
                uint256 ptTokens = totalTokensToEmit * ptRevenue / totalRevenue;
                
                // Get distribution shares for this PT
                (uint256 provShare, uint256 valShare, uint256 ptoShare) = pt.getEmissionShares();
                uint256 totalShares = provShare + valShare + ptoShare;

                // Calculate tokens for each Actor type
                uint256 providersTokens = ptTokens * provShare / totalShares;
                uint256 validatorsTokens = ptTokens * valShare / totalShares;
                uint256 ownerTokens = ptTokens * ptoShare / totalShares;
                
                if (scoresAgregated[i].provRanks.length == 0) {
                    // If there are no Validator scores for this Protocol, then distribute based on the TVS (Total Value Serviced) to Providers. Since there are no Validators, or the Validators haven't done their job, Validators' share of tokens is distributed to Providers.
                    // Providers
                    uint256 totalProviderTvs = 0;
                    uint24[] memory providerIds = pt.getAllProviderIds();
                    ForestCommon.Actor[] memory providers = new ForestCommon.Actor[](providerIds.length);
                    uint256[] memory providersTvs = new uint256[](providerIds.length);
                    for(uint j = 0; j < providerIds.length; j++) {
                        providers[j] = registry.getActorById(providerIds[j]);
                        providersTvs[j] = pt.getActorTvs(providers[j].ownerAddr); 
                        totalProviderTvs += providersTvs[j];
                    }
                    //if the Protocol has no Providers or Active Agreements, skip this Protocol. In this case other Protocols will get tokens that could've been this Protocol's
                    if (totalProviderTvs == 0) {
                        continue; 
                    }
                    for(uint j = 0; j < providerIds.length; j++) {
                        uint256 provTokens = (providersTokens + validatorsTokens) * providersTvs[j] / totalProviderTvs; // TODO: what to do with Validators' tokens if they are no Validators to distribute to? Is distributing them to Providers fine? Distributing to Protocol Owner might incentivize Protocol Owner to produce faulty Validator code.
                        if (provTokens > 0) {
                            _mint(providers[j].billingAddr, provTokens);
                            ptTokensEmitted += provTokens;
                        }
                    }
                } else {
                    // Distribute based on their ranks 
                    // Providers
                    uint256 totalProviderScore = 0;
                    for(uint j = 0; j < scoresAgregated[i].provRanks.length; j++) {
                        totalProviderScore += scoresAgregated[i].provRanks[j][1];
                    }
                    // If the Validators reported only 0s for all Providers, skip distribution to Providers. In such a situation, the emissions for this epoch will be lower than expected (by the amount of tokens that would've been distributed to this Protocol's Providers).
                    if (totalProviderScore != 0 && providersTokens > 0) {
                        for(uint j = 0; j < scoresAgregated[i].provRanks.length; j++) {
                            uint256 provId = scoresAgregated[i].provRanks[j][0];
                            uint256 provScore = scoresAgregated[i].provRanks[j][1];
                            uint256 provTokens = providersTokens * provScore / totalProviderScore;
                            address provAddr = registry.getActorBillingAddressById(uint24(provId));
                            if (provTokens > 0) {
                                _mint(provAddr, provTokens);
                                ptTokensEmitted += provTokens;
                            }
                        }
                    }
                    
                    // Validators
                    uint256 totalValidatorScore = 0;
                    for(uint j = 0; j < scoresAgregated[i].valRanks.length; j++) {
                        totalValidatorScore += scoresAgregated[i].valRanks[j][1];
                    }
                    // If the Slasher's aggregateScores reported only 0s for all Validators, skip distribution to Validators. In such a situation, the emissions for this epoch will be lower than expected (by the amount of tokens that would've been distributed to this Protocol's Validators).
                    if (totalValidatorScore != 0 && validatorsTokens > 0) {
                        for(uint j = 0; j < scoresAgregated[i].valRanks.length; j++) {
                            uint256 valId = scoresAgregated[i].valRanks[j][0];
                            uint256 valScore = scoresAgregated[i].valRanks[j][1];
                            uint256 valTokens = validatorsTokens * valScore / totalValidatorScore;
                            address valAddr = registry.getActorBillingAddressById(uint24(valId));
                            if (valTokens > 0) {
                                _mint(valAddr, valTokens);
                                ptTokensEmitted += valTokens;
                            }
                        }
                    }
                }
                
                // Distribute to Protocol owner
                if (ownerTokens > 0) {
                    _mint(registry.getActor(pt.getOwnerAddr()).billingAddr, ownerTokens);
                    ptTokensEmitted += ownerTokens;
                }

                emit RewardsMinted(_epoch, scoresAgregated[i].ptAddr, scoresAgregated[i].revenueAtEpochClose, ptTokensEmitted);
                totalTokensEmitted += ptTokensEmitted;
            }
        }

        // If for some reason the total tokens emitted is less than the expected amount, burn the difference
        if (totalTokensEmitted < totalTokensToEmit) {
            _mint(address(this), totalTokensToEmit - totalTokensEmitted);
            _burn(address(this), totalTokensToEmit - totalTokensEmitted);
        } 
        
        assert(totalTokensEmitted <= totalTokensToEmit);

        // Mark rewards as emitted for this epoch
        epochRewardsEmittedMap[_epoch] = true;
        lastEmittedEpochBlockNum = _epoch;
        lastEmissionsBlockNum = block.number;
    }

    /***********************************|
    |       Pausable Related            |
    |__________________________________*/

    /// @notice Pauses the contract using OZ Pausable
    /// @dev Available only to the Owner
    function pause() public onlyOwner {
        _pause();
    }

    /// @notice Unpauses the contract using OZ Pausable
    /// @dev Available only to the Owner
    function unpause() public onlyOwner {
        _unpause();
    }

     /***********************************|
    |         Checker Functions          |
    |__________________________________*/

    /// @notice Checks if rewards have been emitted for a given epoch
    /// @param _epoch The epoch number to check
    /// @return True if rewards have been emitted, false otherwise
    function isRewardEmitted(uint256 _epoch) public view returns (bool) {
        return epochRewardsEmittedMap[_epoch];
    }

    /// @notice Ensures that the Registry and Slasher addresses are set
    function onlyWhenRegistryAndSlasherSet() public view {
        if (address(registry) == address(0) || address(slasher) == address(0))
            revert ForestCommon.InvalidAddress();
    }

    /***********************************|
    |         Setter Functions          |
    |__________________________________*/

    /// @notice Sets the adjustment factor for Protocols with no Validator reports
    /// @param _noValidatorPunishmentAdjustment The adjustment factor (current implementation accepts range: 0-10000)
    /// @dev Available only to the Owner
    function setNoValidatorPunishmentAdjustment(uint256 _noValidatorPunishmentAdjustment) public onlyOwner {
        if (_noValidatorPunishmentAdjustment > ForestCommon.HUNDRED_PERCENT_POINTS)
            revert ForestCommon.InvalidParam();
        NO_VALIDATOR_PUNISHMENT_ADJUSTMENT = _noValidatorPunishmentAdjustment;
    }

    /***********************************|
    |         Getter Functions          |
    |__________________________________*/

    /// @notice Returns the address of the Slasher contract
    /// @return The address of the Slasher contract
    function getSlasherAddr() public view returns (address) {
        return address(slasher);
    }   

    /// @notice Returns the address of the Registry contract
    /// @return The address of the Registry contract
    function getRegistryAddr() public view returns (address) {
        return address(registry);
    }

    /// @notice Returns the end block number of the last epoch for which rewards were emitted
    /// @return The end block number of last emitted epoch
    function getLastEmittedEpochBlockNum() public view returns (uint256) {
        return lastEmittedEpochBlockNum;
    }

    /// @notice Returns the block number when the last emissions were made
    /// @return The block number when the last emissions were made
    function getLastEmissionsBlockNum() public view returns (uint256) {
        return lastEmissionsBlockNum;
    }

    // The following function is an override required by Solidity.

    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20, ERC20Pausable) {
        super._update(from, to, value);
    }
}
