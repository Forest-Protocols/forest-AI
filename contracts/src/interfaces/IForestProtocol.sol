// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "../ForestCommon.sol";

interface IForestProtocol {
    error ActorAlreadyRegistered();
    error ActorNotRegistered();
    error ActorWrongType();
    error InsufficientAmount();
    error InvalidAddress();
    error InvalidInitialization();
    error InvalidParam();
    error InvalidState();
    error LimitExceeded();
    error NotInitializing();
    error NotWhitelisted();
    error ObjectActive();
    error ObjectNotActive();
    error OnlyOwnerAllowed();
    error OnlyOwnerOrOperatorAllowed();
    error OwnableInvalidOwner(address owner);
    error OwnableUnauthorizedAccount(address account);
    error Unauthorized();

    event ActorToProtocolRegistered(
        ForestCommon.ActorType indexed actorType, address indexed ownerAddr, uint256 initialCollateral
    );
    event AgreementClosed(uint32 indexed id, address indexed closingAddr);
    event AgreementCreated(uint32 indexed id, uint32 indexed offerId, address indexed userAddr, uint256 balance);
    event BalanceTopup(uint256 agreementId, uint256 amount, address addr);
    event BalanceWithdrawn(uint256 indexed agreementId, uint256 amount, address indexed addr);
    event Initialized(uint64 version);
    event OfferPaused(uint32 indexed id);
    event OfferRegistered(
        uint32 indexed id, address indexed providerAddr, uint256 fee, uint24 stockAmount, string detailsLink
    );
    event OfferUnpaused(uint32 indexed id);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    function closeAgreement(uint32 _agreementId) external;
    function enterAgreement(uint32 _offerId, uint256 _initialDeposit) external returns (uint32);
    function getActiveAgreementsValue() external view returns (uint256);
    function getActorTvs(address _actorAddr) external view returns (uint256);
    function getAgreement(uint32 id) external view returns (ForestCommon.Agreement memory);
    function getAgreementBalance(uint32 _agreementId) external view returns (uint256);
    function getAgreementsCount() external view returns (uint256 count);
    function getAllProviderIds() external view returns (uint24[] memory);
    function getAllValidatorIds() external view returns (uint24[] memory);
    function getBalanceMinusOutstanding(uint32 _agreementId) external view returns (uint256);
    function getDetailsLink() external view returns (string memory);
    function getEmissionShares() external view returns (uint256, uint256, uint256);
    function getFees() external view returns (uint256, uint256, uint256);
    function getMaxActors() external view returns (uint256, uint256);
    function getMinCollateral() external view returns (uint256);
    function getOffer(uint32 id) external view returns (ForestCommon.Offer memory);
    function getOffersCount() external view returns (uint256 count);
    function getOutstandingReward(uint32 _agreementId) external view returns (uint256);
    function getOwnerAddr() external view returns (address);
    function getRegistryAddr() external view returns (address);
    function getTermUpdateDelay() external view returns (uint256);
    function initialize(address _registryAddr) external;
    function isActiveRegisteredAndAuthorizedRepresentative(
        ForestCommon.ActorType _actorType,
        address _ownerAddr,
        address _senderAddr
    ) external view returns (bool isRepresentativeOfActiveRegistered);
    function isActiveRegisteredOwner(ForestCommon.ActorType _actorType, address _ownerAddr)
        external
        view
        returns (bool isOwnerOfActiveRegistered);
    function isActorWhitelisted(address _actorAddr) external view returns (bool);
    function isRegisteredActiveActor(ForestCommon.ActorType _actorType, address _addr)
        external
        view
        returns (bool isRegistered);
    function owner() external view returns (address);
    function pauseOffer(uint32 _offerId) external;
    function registerActor(ForestCommon.ActorType _actorType, uint256 initialCollateral) external;
    function registerOffer(address _providerOwnerAddr, uint256 _fee, uint24 _stockAmount, string memory _detailsLink)
        external
        returns (uint32);
    function renounceOwnership() external;
    function requestOfferClose(uint32 _offerId) external;
    function setDetailsLink(string memory _detailsLink) external;
    function setEmissionShares(uint256 _provShare, uint256 _valShare, uint256 _ptoShare) external;
    function setFees(uint256 _valRegFee, uint256 _provRegFee, uint256 _offerRegFee) external;
    function setMaxActors(uint256 _maxValsNum, uint256 _maxProvsNum) external;
    function setMinCollateral(uint256 _minCollateral) external;
    function setOwner(address _ownerAddr) external;
    function setTermUpdateDelay(uint256 _termUpdateDelay) external;
    function setWhitelistedActors(ForestCommon.ActorType _actorType, address[] memory _whitelistedActors) external;
    function topUpExistingAgreement(uint32 _agreementId, uint256 _amount) external;
    function transferOwnership(address newOwner) external view;
    function unpauseOffer(uint32 _offerId) external;
    function withdrawReward(uint32 _agreementId) external;
    function withdrawUserBalance(uint32 _agreementId, uint256 _amount) external;
}
