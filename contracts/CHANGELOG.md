# Changelog

All notable changes to the contracts package will be documented in this file.

## [v0.5] - 2025-04-18

### Added
- Script for automating protocol registration with basic actors and agreements
- `detailsLink` field for CID of raw test results in EpochScoreGranular
- Last emission epoch block number information in Token contract
- New `RewardsMinted` event in ForestToken contract for easier CLI emissions display:
  ```solidity
  event RewardsMinted(
      uint256 indexed epoch,
      address indexed ptAddr,
      uint256 revenueAtEpochClose,
      uint256 totalTokensEmitted
  );
  ```
  This event is emitted when rewards are distributed to Providers, Validators, and Protocol Owners for a completed epoch, providing transparency about the distribution process.
- New function `getLastEmissionEpochBlockNum()` in ForestToken contract for easier analytics
- New `detailsLink` parameter in ForestSlasher's `commit` function for storing the CID of raw test results

### Changed
- Updated EpochScoreGranular struct in ForestSlasher contract
- Updated deployment script
- Changed visibility of `aggregateScores` in Slasher contract from `internal` to `public`
- Updated deployment addresses in README
- Modified `closeEpoch` function in ForestSlasher to return the closed epoch number (`uint256 closedEpochNum`)

### Fixed
- Cleaned up and fixed Forge dependencies
- Generated new ABIs and interfaces
- Fixed dependency issues in package.json

### Breaking Changes
- Modified `commit` function signature in ForestSlasher contract:
  - Previous signature: `commit(bytes32 _commitHash, address _valAddr, address _ptAddr)`
  - New signature: `commit(bytes32 _commitHash, address _valAddr, address _ptAddr, string memory _detailsLink)`
  - All integrations must update their calls to include the new `_detailsLink` parameter
  - The `_detailsLink` parameter should contain the CID of raw test results stored on IPFS
- Modified `closeEpoch` function in ForestSlasher contract:
  - Previous signature: `closeEpoch()`
  - New signature: `closeEpoch() returns (uint256 closedEpochNum)`
  - All integrations must update their calls to handle the returned epoch number
  - The returned value represents the epoch number that was just closed

### Documentation
- Added deployment addresses in README
- Added TODO comments for future improvements
- Updated README with new features and breaking changes
- Added detailed documentation for new event emissions and function changes

## [Previous Version] - 2025-02-21

Initial release of the contracts package. 