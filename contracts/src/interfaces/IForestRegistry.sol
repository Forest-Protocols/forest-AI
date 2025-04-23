// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "../ForestCommon.sol";

interface IForestRegistry {
    error ActorAlreadyRegistered();
    error EnforcedPause();
    error ExpectedPause();
    error FailedDeployment();
    error InsufficientBalance(uint256 balance, uint256 needed);
    error InvalidAddress();
    error InvalidParam();
    error LimitExceeded();
    error OnlyOwnerAllowed();
    error OwnableInvalidOwner(address owner);
    error OwnableUnauthorizedAccount(address account);

    event ActorDetailsUpdated(
        ForestCommon.ActorType indexed actorType,
        address indexed ownerAddr,
        address operatorAddr,
        address billingAddr,
        string detailsLink
    );
    event NetworkParamUpdated(string indexed paramName);
    event NewActorRegistered(
        ForestCommon.ActorType indexed actorType,
        address indexed ownerAddr,
        address operatorAddr,
        address billingAddr,
        string detailsLink
    );
    event NewProtocolRegistered(address indexed addr, address indexed ownerAddr, string detailsLink);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Paused(address account);
    event ProtocolDetailsUpdated(address indexed ownerAddr, address indexed operatorAddr, string detailsLink);
    event PtStatusUpdated(address indexed ownerAddr, ForestCommon.Status status);
    event Unpaused(address account);

    function createProtocol(
        uint256 _maxValsNum,
        uint256 _maxProvsNum,
        uint256 _minCollateral,
        uint256 _valRegFee,
        uint256 _provRegFee,
        uint256 _offerRegFee,
        uint256 _termUpdateDelay,
        uint256 _provShare,
        uint256 _valShare,
        uint256 _ptoShare,
        string memory _detailsLink
    ) external returns (address);
    function getActor(address _addr) external view returns (ForestCommon.Actor memory);
    function getActorBillingAddressById(uint24 _id) external view returns (address);
    function getActorById(uint24 _id) external view returns (ForestCommon.Actor memory);
    function getActorCount() external view returns (uint256);
    function getActorInPtRegFee() external view returns (uint256);
    function getActorRegFee() external view returns (uint256);
    function getAllProviders() external view returns (ForestCommon.Actor[] memory);
    function getAllPtAddresses() external view returns (address[] memory);
    function getAllPtos() external view returns (ForestCommon.Actor[] memory);
    function getAllValidators() external view returns (ForestCommon.Actor[] memory);
    function getBurnRatio() external view returns (uint256);
    function getForestTokenAddr() external view returns (address);
    function getMaxProtocolsNum() external view returns (uint256);
    function getOfferInPtRegFee() external view returns (uint256);
    function getProvidersCount() external view returns (uint256);
    function getPtCount() external view returns (uint256);
    function getPtRegFee() external view returns (uint256);
    function getRevenueShare() external view returns (uint256);
    function getSlasherAddr() external view returns (address);
    function getTreasuryAddr() external view returns (address);
    function getUsdcTokenAddr() external view returns (address);
    function getValidatorsCount() external view returns (uint256);
    function isActiveActor(address _owner) external view returns (bool isActive);
    function isOwnerOrOperatorOfRegisteredActiveActor(
        ForestCommon.ActorType _actorType,
        address _owner,
        address _senderAddr
    ) external view returns (bool isRegistered);
    function isPtRegisteredAndActive(address _addr) external view returns (bool);
    function isRegisteredActiveActor(ForestCommon.ActorType _actorType, address _owner)
        external
        view
        returns (bool isRegistered);
    function owner() external view returns (address);
    function pause() external;
    function paused() external view returns (bool);
    function registerActor(
        ForestCommon.ActorType _actorType,
        address _operatorAddr,
        address _billingAddr,
        string memory _detailsLink
    ) external returns (uint24);
    function renounceOwnership() external;
    function setActorInPtRegFee(uint256 _newValue) external;
    function setActorRegFee(uint256 _newValue) external;
    function setBurnRatio(uint256 _newValue) external;
    function setForestTokenAddress(address _newValue) external;
    function setMaxProtocolsNum(uint256 _newValue) external;
    function setOfferInPtRegFee(uint256 _newValue) external;
    function setPtRegFee(uint256 _newValue) external;
    function setRevenueShare(uint256 _newValue) external;
    function setSlasherAddress(address _newValue) external;
    function setTreasuryAddrParam(address _newValue) external;
    function setUsdcTokenAddress(address _newValue) external;
    function transferOwnership(address newOwner) external;
    function transferTokensToTreasury(address _from, uint256 _amount) external;
    function unpause() external;
    function updateActorDetails(
        ForestCommon.ActorType _actorType,
        address _operatorAddr,
        address _billingAddr,
        string memory _detailsLink
    ) external;
}
