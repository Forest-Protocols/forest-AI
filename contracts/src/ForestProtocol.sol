// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/interfaces/IERC20Metadata.sol";
import "./interfaces/IForestRegistry.sol";
import "./interfaces/IForestSlasher.sol";

/**
 * @title Template contract for a Protocol in Forest Network
 * @notice This contract manages single Forest Network Protocol's lifecycle
 */
contract ForestProtocol is OwnableUpgradeable {

    /***********************************|
    |              Events               |
    |__________________________________*/

    event ActorToProtocolRegistered(
        ForestCommon.ActorType indexed actorType,
        address indexed ownerAddr,
        uint initialCollateral
    );

    event OfferRegistered(
        uint32 indexed id,
        address indexed providerAddr,
        uint fee,
        uint24 stockAmount,
        string detailsLink
    );

    event OfferPaused(uint32 indexed id);

    event OfferUnpaused(uint32 indexed id);

    event AgreementCreated(
        uint32 indexed id,
        uint32 indexed offerId,
        address indexed userAddr,
        uint balance
    );

    event AgreementClosed(
        uint32 indexed id,
        address indexed closingAddr
    );

    event BalanceTopup(uint agreementId, uint amount, address addr);

    event BalanceWithdrawn(
        uint indexed agreementId,
        uint amount,
        address indexed addr
    );

    // event ProtocolParamUpdated(
    //     string indexed paramName
    // );

    /***********************************|
    |               Structs             |
    |__________________________________*/

    // struct ActorWhitelistEntry {
    //     ForestCommon.ActorType actorType;
    //     uint8 version;
    // }

    /***********************************|
    |         Protocol Params          |
    |__________________________________*/

    struct ProtocolSettings {
        uint maxValsNum; // Maximum number of Validators allowed in this Protocol, 0 means no limit
        uint maxProvsNum; // Maximum number of Providers allowed in this Protocol, 0 means no limit
        uint minCollateral; // Minimum collateral required for Actors
        uint valRegFee; // Registration fee in this Protocol for a Validator
        uint provRegFee; // Registration fee in this Protocol for a Provider
        uint offerRegFee; // Registration fee in this Protocol for an Offer
        uint termUpdateDelay; // Delay required before terms can be updated
        uint provShare; // Provider's share of rewards, 0 - 10000
        uint valShare; // Validator's share of rewards, 0 - 10000
        uint ptoShare; // Protocol Owner's share of rewards, 0 - 10000
        string detailsLink; // Hash of the Protocol details file
        // TODO: add a maxSlashAmount 
        //mapping(address => ActorWhitelistEntry) whitelistedActors;
        mapping(address => uint8) whitelistedActors;
    }

    /***********************************|
    |            Variables              |
    |__________________________________*/

    // Protocol meta data
    address ownerAddr; // Address of the Protocol Owner
    uint registrationTs; // Timestamp when the Protocol was registered
    // Protocol base state
    uint24[] provIds; // Array of Provider IDs
    uint24[] valIds; // Array of Validator IDs
    mapping(address => ForestCommon.ActorType) registeredActors; // Map of registered Actors, key is the Actor address, value is the Actor type with 0 value meaning no Actor registered
    ForestCommon.Offer[] offers; // Array of Offers
    ForestCommon.Agreement[] agreements;
    // parameters set by Protocol Owner
    ProtocolSettings settings;
    // stats
    uint activeAgreementsValue; // How much revenue per month this Protocol is facilitating for its Providers 
    uint32 offerIdCounter; // Counter for offer IDs
    uint32 agreementIdCounter; // Counter for agreement IDs
    mapping(address => uint256) actorTvs; // Map of Total Value Serviced for each actor
    // related contracts
    IForestRegistry registry; // Registry contract
    IForestSlasher slasher; // Slasher contract
    IERC20Metadata usdcToken; // USDC token contract
    // whitelist related variables
    //uint8 providerWhitelistVersion;
    //uint8 validatorWhitelistVersion;
    uint8 userWhitelistVersion;
    //uint8 providerWhitelistCount;
    //uint8 validatorWhitelistCount;
    uint8 userWhitelistCount;
    
    /***********************************|
    |            Constructor            |
    |__________________________________*/

    /// @notice Initializes the Protocol with related contracts (sets Registry and the subsequent contracts based on info from the Registry), sets the Owner and registration timestamp
    /// @dev Since this is an upgradeable-style contract, we need to initialize with a call to initialize rather than depending on the constructor. This can be called only once.
    /// @param _registryAddr Address of the Registry contract
    function initialize(address _registryAddr) initializer public {
        if (_registryAddr == address(0))
            revert ForestCommon.InvalidAddress();
        __Ownable_init(_registryAddr);
        ownerAddr = _registryAddr;
        registrationTs = block.timestamp;
        registry = IForestRegistry(_registryAddr);
        slasher = IForestSlasher(registry.getSlasherAddr()); 
        usdcToken = IERC20Metadata(registry.getUsdcTokenAddr());
    }

    /***********************************|
    |              Modifiers            |
    |__________________________________*/

    // function _isPaused() internal view {
    //     if(isPaused())
    //         revert ForestCommon.EnforcedPause();
    // }
    
    // modifier whenNotPaused() {
    //     _isPaused();
    //     _;
    // }

    // function _isNotPaused() internal view {
    //     if(!isPaused())
    //         revert ForestCommon.ExpectedPause();
    // }

    // modifier whenPaused() {
    //     _isNotPaused();
    //     _;
    // }

    /***********************************|
    |          SC Functions             |
    |__________________________________*/

    /// @notice Registers a new Actor (Provider or Validator) in this Protocol, transfers collateral to the Slasher contract, transfers registration fee to the Treasury
    /// @dev Requires Actor to be registered in Registry and provide sufficient collateral
    /// @param _actorType Type of Actor (Provider or Validator allowed only)
    /// @param initialCollateral Amount of collateral to stake
    function registerActor(ForestCommon.ActorType _actorType, uint initialCollateral) public { // whenNotPaused
        // allow only Provider or Validator to register
        if (_actorType != ForestCommon.ActorType.PROVIDER && _actorType != ForestCommon.ActorType.VALIDATOR)
            revert ForestCommon.ActorWrongType();
        // check against the whitelist
        // if (!isActorWhitelisted(_actorType, _msgSender()))
        //     revert ForestCommon.NotWhitelisted();
        // check if Actor of the requested type is already registered in Registry
        if (!registry.isRegisteredActiveActor(_actorType, _msgSender()))
            revert ForestCommon.ActorNotRegistered();
        // check if Actor is already registered in this Protocol
        if (registeredActors[_msgSender()] != ForestCommon.ActorType.NONE)
            revert ForestCommon.ActorAlreadyRegistered();
        // check if we haven't exceeded the max number of Actors of this type
        if (_actorType == ForestCommon.ActorType.PROVIDER && provIds.length >= settings.maxProvsNum)
            revert ForestCommon.LimitExceeded();
        if (_actorType == ForestCommon.ActorType.VALIDATOR && valIds.length >= settings.maxValsNum)
            revert ForestCommon.LimitExceeded();
        // check if collateral is sufficient
        if (initialCollateral < settings.minCollateral)
            revert ForestCommon.InsufficientAmount();
        
        // pay registration fee
        uint actorRegFee = registry.getActorInPtRegFee() + (_actorType == ForestCommon.ActorType.PROVIDER ? settings.provRegFee : settings.valRegFee);
        registry.transferTokensToTreasury(_msgSender(), actorRegFee); // @dev so the approval needs to be for the registry contract

        // transfer the collateral to the Slasher contract
        slasher.topupActorCollateral(address(this), _actorType, _msgSender(), initialCollateral);

        // save this registration info in the PT state
        registeredActors[_msgSender()] = _actorType;
        if (_actorType == ForestCommon.ActorType.PROVIDER)
            provIds.push(registry.getActor(_msgSender()).id);
        else
            valIds.push(registry.getActor(_msgSender()).id);

        emit ActorToProtocolRegistered(_actorType, _msgSender(), initialCollateral);
    }

    // TODO: deregister an Actor forcefully by Protocol Owner and self deregistration by Actor

    /// @notice Registers a new Offer from a Provider
    /// @dev Provider must be registered and active in this Protocol, can be called only by authorized representatives of the Provider (Owner or Operator)
    /// @param _providerOwnerAddr Address of the Provider owner
    /// @param _fee Fee per time unit for the service
    /// @param _stockAmount Available capacity for this service
    /// @param _detailsLink Hash of the offer details file
    /// @return Offer ID
    function registerOffer(
        address _providerOwnerAddr,
        uint _fee,
        uint24 _stockAmount,
        string memory _detailsLink
    ) public returns (uint32) { // whenNotPaused
        // check params
        if (_fee <= 0) 
            revert ForestCommon.InvalidParam();
        if (_stockAmount <= 0) 
            revert ForestCommon.InvalidParam();
        if (bytes(_detailsLink).length == 0)
            revert ForestCommon.InvalidParam();

        // check if the provider is registered in the protocol and if the sender is allowed to act on the providers behalf
        // and check if the Provider is registered in this Protocol as a Provider 
        if (!isActiveRegisteredAndAuthorizedRepresentative(ForestCommon.ActorType.PROVIDER, _providerOwnerAddr, _msgSender()))
            revert ForestCommon.OnlyOwnerOrOperatorAllowed();

        // pay the registration fee
        registry.transferTokensToTreasury(_msgSender(), settings.offerRegFee + registry.getOfferInPtRegFee());

        // create the offer
        uint32 offerId = offerIdCounter++;
        ForestCommon.Offer memory offer = ForestCommon.Offer(
            offerId,
            ForestCommon.Status.ACTIVE,
            _providerOwnerAddr,
            _fee,
            0,
            _stockAmount,
            _detailsLink,
            0
        );
        
        offers.push(offer);

        emit OfferRegistered(
            offerId,
            _providerOwnerAddr,
            _fee,
            _stockAmount,
            _detailsLink
        );

        return offerId;
    }

    /// @notice Requests to close an Offer. This is to be used by Providers who want to stop providing a service based on a previously created Offer.
    /// @dev Can be called only by authorized representatives of the Provider (Owner or Operator)
    /// @param _offerId ID of the offer to request close
    function requestOfferClose(uint32 _offerId) public {
        if (!registry.isOwnerOrOperatorOfRegisteredActiveActor(ForestCommon.ActorType.PROVIDER, offers[_offerId].ownerAddr, _msgSender()))
            revert ForestCommon.OnlyOwnerOrOperatorAllowed();
         offers[_offerId].closeRequestTs = block.timestamp;
    }

    // TODO: change Offer params, not now, Provider can pause an Offer not to allow new Agreements and create a new one with updated specs, also it's possible to request Offer close which means that after time from Protocol settings passed, Provider can close all Agreements based on this Offer

    /// @notice Pauses an Offer to prevent new Agreements from being created based on it
    /// @dev Can be called only by authorized representatives of the Provider (Owner or Operator)
    /// @param _offerId ID of the Offer to pause
    function pauseOffer(uint32 _offerId) public {
        if (!registry.isOwnerOrOperatorOfRegisteredActiveActor(ForestCommon.ActorType.PROVIDER, offers[_offerId].ownerAddr, _msgSender()))
            revert ForestCommon.OnlyOwnerOrOperatorAllowed();
        if (offers[_offerId].status != ForestCommon.Status.ACTIVE)
            revert ForestCommon.ObjectNotActive();
        offers[_offerId].status = ForestCommon.Status.NOTACTIVE;
        emit OfferPaused(_offerId);
    }

    /// @notice Unpauses an Offer to allow new Agreements to be created based on it
    /// @dev Can be called only by authorized representatives of the Provider (Owner or Operator)
    /// @param _offerId ID of the Offer to unpause
    function unpauseOffer(uint32 _offerId) public {
        if (!registry.isOwnerOrOperatorOfRegisteredActiveActor(ForestCommon.ActorType.PROVIDER, offers[_offerId].ownerAddr, _msgSender()))
            revert ForestCommon.OnlyOwnerOrOperatorAllowed();
        if (offers[_offerId].status != ForestCommon.Status.NOTACTIVE)
            revert ForestCommon.ObjectActive();
        offers[_offerId].status = ForestCommon.Status.ACTIVE;
        emit OfferUnpaused(_offerId);
    }

    /// @notice Creates a new service Agreement between User and Provider
    /// @dev Requires active Offer and sufficient initial deposit
    /// @param _offerId ID of the service Offer
    /// @param _initialDeposit Initial balance for the Agreement
    /// @return Agreement ID
    function enterAgreement(
        uint32 _offerId,
        uint _initialDeposit
    ) public returns (uint32) { // whenNotPaused
        // validate args
        ForestCommon.Offer storage chosenOffer = offers[_offerId];
        // make sure the offer is not paused
        if (chosenOffer.status != ForestCommon.Status.ACTIVE)
            revert ForestCommon.ObjectNotActive();
        // check if the user is whitelisted
        // if (!isActorWhitelisted(ForestCommon.ActorType.USER, _msgSender()) && !isActorWhitelisted(ForestCommon.ActorType.VALIDATOR, _msgSender()))
        if (!isActorWhitelisted(_msgSender())) 
            revert ForestCommon.NotWhitelisted();

        uint _minimumFee = 2 * 2635200 * chosenOffer.fee;
        uint networkRevenueShareFee = _initialDeposit * registry.getRevenueShare() / ForestCommon.HUNDRED_PERCENT_POINTS;
        
        // check if initialDeposit is enough
        if (_initialDeposit < _minimumFee)
            revert ForestCommon.InsufficientAmount();

        // check if the offer has availability
        if (chosenOffer.stockAmount <= chosenOffer.activeAgreements)
            revert ForestCommon.LimitExceeded();

        // pay the Network fee
        usdcToken.transferFrom(_msgSender(), registry.getTreasuryAddr(), networkRevenueShareFee);

        // pay the initial deposit
        uint initialBalance = _initialDeposit - networkRevenueShareFee;
        usdcToken.transferFrom(_msgSender(), address(this), initialBalance);

        // create a new Agreement
        uint32 agreementId = agreementIdCounter++;

        ForestCommon.Agreement memory agreement = ForestCommon.Agreement(
            agreementId,
            _offerId,
            _msgSender(),
            initialBalance,
            block.timestamp,
            0,
            0,
            block.timestamp,
            ForestCommon.Status.ACTIVE
        );

        agreements.push(agreement);

        // update offer state
        chosenOffer.activeAgreements += 1;

        // add the fee value to activeAgreementsValue for subsequent ranking of Protocols
        activeAgreementsValue += chosenOffer.fee;

        // add the fee value to the Actor's TVS
        actorTvs[chosenOffer.ownerAddr] += chosenOffer.fee;

        emit AgreementCreated(
            agreementId,
            _offerId,
            _msgSender(),
            initialBalance
        );

        emit BalanceTopup(agreementId, initialBalance, _msgSender());

        return agreementId;
    }

    // TODO: business question: should we allow topup from non-Owners?

    /// @notice Topups an existing agreement with additional funds
    /// @dev Can be called by the user who is a party to the agreement
    /// @param _agreementId ID of the agreement to topup
    /// @param _amount Amount to topup
    function topUpExistingAgreement(
        uint32 _agreementId,
        uint _amount
    ) public { // whenNotPaused
        // validate args
        ForestCommon.Agreement storage agreement = agreements[_agreementId];
        
        if (agreement.status != ForestCommon.Status.ACTIVE)
            revert ForestCommon.ObjectNotActive();

        usdcToken.transferFrom(_msgSender(), address(this), _amount);

        agreement.balance += _amount;
        
        emit BalanceTopup(_agreementId, _amount, _msgSender());
    }

    /// @notice Withdraws funds from an agreement. 
    /// @dev Can be called only by the user who is a party to the agreement. The balance after the opertaion must cover 2-months of fees.
    /// @param _agreementId ID of the agreement to withdraw from
    /// @param _amount Amount to withdraw
    function withdrawUserBalance(uint32 _agreementId, uint _amount) public {
        ForestCommon.Agreement storage agreement = agreements[_agreementId];

        if (2 * 2635200 * offers[agreement.offerId].fee > agreement.balance - _amount) // TODO: possibly add check if _amount > agreement.balance for better error transparency
            revert ForestCommon.InsufficientAmount();
        _withdrawUserBalance(agreement, _amount);
    }

    /// @notice Withdraws funds from an agreement.
    /// @dev  Is to be used as an internal call only from the closeAgreement and the public withdrawUserBalance function. Doesn't check if after the balance coverts 2-months fees because needs to be used also by closeAgreement.
    /// @param _agreement Agreement to withdraw from
    /// @param _amount Amount to withdraw
    function _withdrawUserBalance(ForestCommon.Agreement storage _agreement, uint _amount) internal {
        if (_agreement.userAddr != _msgSender())
            revert ForestCommon.OnlyOwnerAllowed();

        uint amount = getBalanceMinusOutstanding(_agreement.id);
        if (_amount > amount)
            revert ForestCommon.InsufficientAmount();
     
        // update agreement state
        _agreement.balance -= _amount;
        
        // transfer tokens to user
        usdcToken.transfer(_agreement.userAddr, _amount);

        emit BalanceWithdrawn(_agreement.id, _amount, _agreement.userAddr);
    }

    /// @notice Withdraws the Provider's earned fees from an agreement.
    /// @dev Can be called only by authorized representatives of the Provider (himself or operator)
    /// @param _agreementId ID of the agreement to withdraw from
    function withdrawReward(uint32 _agreementId) public { // whenNotPaused
        // validate params
        // only allow Active agreements to be withdrawn, if closed then withdrawal must've have happened
        ForestCommon.Agreement storage agreement = agreements[_agreementId];
        if (agreement.status != ForestCommon.Status.ACTIVE)
            revert ForestCommon.ObjectNotActive();

        address offerOwnerAddr = offers[agreement.offerId].ownerAddr;

        // check if the caller is the owner or an operator of the provider serving the offer
        if (!isActiveRegisteredAndAuthorizedRepresentative(ForestCommon.ActorType.PROVIDER, offerOwnerAddr, _msgSender()))
            revert ForestCommon.OnlyOwnerOrOperatorAllowed();

        address providerBillingAddr = registry.getActor(offerOwnerAddr).billingAddr;
       
        // get amount to be withdrawn
        uint rewardAmount = getOutstandingReward(agreement.id);

        // make sure there is no business logic overflow
        // if balance is less than reward amount, then the Provider failed to close the agreement at the right moment
        if (agreement.balance < rewardAmount) {
            rewardAmount = agreement.balance;
        }

        // update agreement state
        agreement.provClaimedTs = block.timestamp;
        agreement.balance -= rewardAmount;
        agreement.provClaimedAmount += rewardAmount;
       
        // transfer reward to provider
        usdcToken.transfer(
            providerBillingAddr,
            rewardAmount
        );

        emit BalanceWithdrawn(
            _agreementId,
            rewardAmount,
            providerBillingAddr
        );
    }

    /// @notice Closes an existing active service agreement. The calling user gets outstanding funds if available.
    /// @dev Can be called by user anytime or provider in two situations: 1) when the user has run-out of funds 2) after the Provider requested to have the right to close all agreements based on a certain offer ID and the delay period has passed
    /// @param _agreementId ID of the agreement to close
    function closeAgreement(uint32 _agreementId) public { // whenNotPaused
        // validate args
        ForestCommon.Agreement storage agreement = agreements[_agreementId];
        if (agreement.status != ForestCommon.Status.ACTIVE)
            revert ForestCommon.ObjectNotActive();

        uint balanceOfAgreement = getBalanceMinusOutstanding(agreement.id);
        ForestCommon.Offer storage offer = offers[agreement.offerId];
        // handle different cases given different behaviour based on calling actor type
        if (_msgSender() == agreement.userAddr) {
           // logic for handling a close by the User
            _withdrawUserBalance(agreement, balanceOfAgreement);
        } else {
            // logic for handling a forced close by Provider
            if ((balanceOfAgreement > 0 && offer.closeRequestTs == 0) || (offer.closeRequestTs != 0 && offer.closeRequestTs + settings.termUpdateDelay > block.timestamp))
                revert ForestCommon.InvalidState();
            withdrawReward(agreement.id);
        }

        // update Agreement status
        agreement.status = ForestCommon.Status.NOTACTIVE;
        agreement.endTs = block.timestamp;

        // update offer state
        offer.activeAgreements -= 1;

        // remove the fee value from activeAgreementsValue for subsequent ranking of Protocols
        activeAgreementsValue -= offer.fee;

        // remove the fee value from the Actor's TVS
        actorTvs[offer.ownerAddr] -= offer.fee;

        emit AgreementClosed(
            _agreementId,
            _msgSender()
        );
    }

    /***********************************|
    |       Pausable Related            |
    |__________________________________*/

    // function pause() external onlyOwner whenNotPaused {
    //     // TODO: the accounting on the agreement level falls apart when the contract is paused
    //     // we should pay out the outstanding rewards to all of the providers
    //     // and then we can pause the contract for it to work properly
    //     registry.pausePt();
    // }

    // function unpause() external onlyOwner whenPaused {
    //     // TODO: for the accounting to work properly we need to set all agreements' provClaimedTs to timestamp of the block when the contract was unpaused
    //     registry.unpausePt();
    // }

    /***********************************|
    |         Checker Functions          |
    |__________________________________*/

    // function isPaused() public view returns (bool) {
    //     return !registry.isPtRegisteredAndActive(address(this));
    // }

    /// @notice Checks if an Actor is registered and active in this Protocol
    /// @param _actorType Type of Actor (Provider or Validator allowed only)
    /// @param _addr Address of the Actor
    /// @return isRegistered True if the Actor is registered and active in this Protocol
    function isRegisteredActiveActor(ForestCommon.ActorType _actorType, address _addr) public view returns (bool isRegistered) {
        return registeredActors[_addr] == _actorType;
    }

    /// @notice Checks if an Actor is active and registered in this Protocol as well in the Registry and if the calling address is an authorized representative of that actor
    /// @param _actorType Type of Actor (Provider or Validator allowed only)
    /// @param _ownerAddr Owner address of the Actor to be checked
    /// @param _senderAddr Address of the caller
    /// @return isRepresentativeOfActiveRegistered True if the calling address is an authorized representative of a registered and active actor
    function isActiveRegisteredAndAuthorizedRepresentative(ForestCommon.ActorType _actorType, address _ownerAddr, address _senderAddr) public view returns (bool isRepresentativeOfActiveRegistered) {
        if (!registry.isOwnerOrOperatorOfRegisteredActiveActor(_actorType, _ownerAddr, _senderAddr)
        || !isRegisteredActiveActor(_actorType, _ownerAddr)) 
            return false;
        return true;
    }

    /// @notice Checks if an Actor is active and registered in this Protocol as well in the Registry
    /// @param _actorType Type of Actor (Provider or Validator allowed only)
    /// @param _ownerAddr Owner address of the Actor to be checked
    /// @return isOwnerOfActiveRegistered True if the Actor is active and registered in this Protocol as well in the Registry
    function isActiveRegisteredOwner(ForestCommon.ActorType _actorType, address _ownerAddr) public view returns (bool isOwnerOfActiveRegistered) {
        if (!registry.isRegisteredActiveActor(_actorType, _ownerAddr)
        || !isRegisteredActiveActor(_actorType, _ownerAddr))
            return false;
        return true;
    }

    /***********************************|
    |         Setter Functions          |
    |__________________________________*/

    /// @notice Sets the owner of the Protocol
    /// @dev Can be called only by the Owner of the Protocol
    /// @param _ownerAddr Address of the new Owner, can't be 0 address and must be registered as a Protocol Owner in the Registry
    function setOwner(address _ownerAddr) external onlyOwner {
        if (!registry.isRegisteredActiveActor(ForestCommon.ActorType.PT_OWNER, _ownerAddr))
            revert ForestCommon.ActorNotRegistered();
        if (_ownerAddr == address(0))
            revert ForestCommon.InvalidAddress();
        ownerAddr = _ownerAddr;
        _transferOwnership(_ownerAddr);
    }

    // @dev override the default implementation of the Ownable contract, can't be called, setOwner should be used instead
    function transferOwnership(address newOwner) public view override onlyOwner {
        revert ForestCommon.Unauthorized();
    }

    /// @notice Sets the maximum number of Validators and Providers allowed in the Protocol
    /// @dev Can be called only by the Owner of the Protocol
    /// @param _maxValsNum Maximum number of Validators allowed in the Protocol
    /// @param _maxProvsNum Maximum number of Providers allowed in the Protocol
    function setMaxActors(uint _maxValsNum, uint _maxProvsNum) external onlyOwner {
        settings.maxValsNum = _maxValsNum;
        settings.maxProvsNum = _maxProvsNum;
        //emit ProtocolParamUpdated("maxActorsNums");
    }

    /// @notice Sets the minimum collateral required to register an Actor in the Protocol
    /// @dev Can be called only by the Owner of the Protocol
    /// @param _minCollateral Minimum collateral required to register an Actor in the Protocol
    function setMinCollateral(uint _minCollateral) external onlyOwner {
        settings.minCollateral = _minCollateral;
        //emit ProtocolParamUpdated("minCollateral");
    }

    /// @notice Sets the registration fees for Validators, Providers and Offers in the Protocol
    /// @dev Can be called only by the Owner of the Protocol
    /// @param _valRegFee Registration fee in this Protocol for a Validator
    /// @param _provRegFee Registration fee in this Protocol for a Provider
    /// @param _offerRegFee Registration fee in this Protocol for an Offer
    function setFees(uint _valRegFee, uint _provRegFee, uint _offerRegFee) external onlyOwner {
        settings.valRegFee = _valRegFee;
        settings.provRegFee = _provRegFee;
        settings.offerRegFee = _offerRegFee;
        //emit ProtocolParamUpdated("regFees");
    }

    /// @notice Sets the delay before terms of Offers / Agreements can be updated in this Protocol
    /// @dev Can be called only by the Owner of the Protocol
    /// @param _termUpdateDelay Delay in seconds before terms can be updated
    function setTermUpdateDelay(uint _termUpdateDelay) external onlyOwner {
        settings.termUpdateDelay = _termUpdateDelay;
        //emit ProtocolParamUpdated("termUpdateDelay");
    }

    /// @notice Sets the emission shares for Providers, Validators and the Protocol Owner
    /// @dev Can be called only by the Owner of the Protocol
    /// @param _provShare Share of the revenue in this Protocol for Providers, 0 - 10000
    /// @param _valShare Share of the revenue in this Protocol for Validators, 0 - 10000
    /// @param _ptoShare Share of the revenue in this Protocol for the Protocol Owner, 0 - 10000
    function setEmissionShares(uint _provShare, uint _valShare, uint _ptoShare) external onlyOwner {
        if (_provShare + _valShare + _ptoShare != ForestCommon.HUNDRED_PERCENT_POINTS)
            revert ForestCommon.InvalidParam();
        settings.provShare = _provShare;
        settings.valShare = _valShare;
        settings.ptoShare = _ptoShare;
        //emit ProtocolParamUpdated("emissionShares");
    }

    /// @notice Sets the hash of the Protocol details file
    /// @dev Can be called only by the Owner of the Protocol
    /// @param _detailsLink Hash of the Protocol details file
    function setDetailsLink(string memory _detailsLink) external onlyOwner {
        settings.detailsLink = _detailsLink;
        //emit ProtocolParamUpdated("detailsLink");
    }

    /// @notice Sets the whitelisted actors for the protocol, no checks are made on the actors' registration status
    /// @dev Can be called only by the Owner of the Protocol
    /// @param _actorType Type of actor to whitelist
    /// @param _whitelistedActors Array of addresses to whitelist
    // function setWhitelistedActors(ForestCommon.ActorType _actorType, address[] memory _whitelistedActors) external onlyOwner {
    //     // TODO: what to do with registered providers and validators as well as users with active agreements who got in on the previous whitelist?
    //     uint8 versionNum;

    //     if (_actorType == ForestCommon.ActorType.USER) {
    //         versionNum = ++userWhitelistVersion;
    //         userWhitelistCount = uint8(_whitelistedActors.length);
    //     } 
    //     else if (_actorType == ForestCommon.ActorType.VALIDATOR) {
    //         versionNum = ++validatorWhitelistVersion;
    //         validatorWhitelistCount = uint8(_whitelistedActors.length);
    //     } else if (_actorType == ForestCommon.ActorType.PROVIDER) {
    //         versionNum = ++providerWhitelistVersion;
    //         providerWhitelistCount = uint8(_whitelistedActors.length);
    //     } else 
    //         revert ForestCommon.InvalidParam();

    //     for (uint i = 0; i < _whitelistedActors.length; i++) {
    //         settings.whitelistedActors[_whitelistedActors[i]] = ActorWhitelistEntry({
    //             actorType: _actorType,
    //             version: versionNum
    //         });
    //     }
    // }

    // In this minimal user-only whitelist, remmeber to whitelist your validators as users for them to be able to buy service from you
    function setWhitelistedActors(ForestCommon.ActorType _actorType, address[] memory _whitelistedActors) external onlyOwner {
        // TODO: what to do with registered providers and validators as well as users with active agreements who got in on the previous whitelist?
        if (_actorType != ForestCommon.ActorType.USER) 
            revert ForestCommon.InvalidParam();
        
        userWhitelistVersion = userWhitelistVersion+1;
        userWhitelistCount = uint8(_whitelistedActors.length);

        for (uint i = 0; i < _whitelistedActors.length; i++)
            settings.whitelistedActors[_whitelistedActors[i]] = userWhitelistVersion;
    }
    
    /***********************************|
    |         Getter Functions          |
    |__________________________________*/
    
    /// @notice Gets the address of the Protocol Owner
    /// @return ownerAddr Address of the Protocol Owner
    function getOwnerAddr() external view returns (address) {
        return ownerAddr;
    }

    /// @notice Gets the address of the Registry contract
    /// @return registryAddr Address of the Registry contract
    function getRegistryAddr() external view returns (address) {
        return address(registry);
    }

    /// @notice Gets the maximum number of Validators and Providers allowed in the Protocol
    /// @return maxValsNum Maximum number of Validators allowed in the Protocol
    /// @return maxProvsNum Maximum number of Providers allowed in the Protocol
    function getMaxActors() external view returns (uint, uint) {
        return (settings.maxValsNum, settings.maxProvsNum);
    }

    /// @notice Gets the minimum collateral required to register an Actor in the Protocol
    /// @return minCollateral Minimum collateral required to register an Actor in the Protocol
    function getMinCollateral() external view returns (uint) {
        return settings.minCollateral;
    }

    /// @notice Gets the registration fees for Validators, Providers and Offers in the Protocol
    /// @return valRegFee Registration fee in this Protocol for a Validator
    /// @return provRegFee Registration fee in this Protocol for a Provider
    /// @return offerRegFee Registration fee in this Protocol for an Offer
    function getFees() external view returns (uint, uint, uint) {
        return (settings.valRegFee, settings.provRegFee, settings.offerRegFee);
    }

    /// @notice Gets the delay before terms of Offers / Agreements can be updated in this Protocol
    /// @return termUpdateDelay Delay in seconds before terms can be updated
    function getTermUpdateDelay() external view returns (uint) {
        return settings.termUpdateDelay;
    }

    /// @notice Gets the emission shares for Providers, Validators and the Protocol Owner
    /// @return provShare Share of the revenue in this Protocol for Providers, 0 - 10000
    /// @return valShare Share of the revenue in this Protocol for Validators, 0 - 10000
    /// @return ptoShare Share of the revenue in this Protocol for the Protocol Owner, 0 - 10000
    function getEmissionShares() external view returns (uint, uint, uint) {
        return (settings.provShare, settings.valShare, settings.ptoShare);
    }

    /// @notice Gets the hash of the Protocol details file
    /// @return detailsLink Hash of the Protocol details file
    function getDetailsLink() external view returns (string memory) {
        return settings.detailsLink;
    }

    /// @notice Gets the number of Offers in the Protocol
    /// @return count Number of Offers in the Protocol
    function getOffersCount() external view returns (uint count) {
        return offers.length;
    }

    /// @notice Gets an Offer by its ID
    /// @param id ID of the Offer to get
    /// @return offer Offer with the given ID
    function getOffer(uint32 id) external view returns (ForestCommon.Offer memory) {
        return offers[id];
    }

    /// @notice Gets the number of Agreements in the Protocol including inactive ones
    /// @return count Number of Agreements in the Protocol
    function getAgreementsCount() external view returns (uint count) {
        return agreements.length;
    }

    /// @notice Gets an Agreement by its ID
    /// @param id ID of the Agreement to get
    /// @return agreement Agreement with the given ID
    function getAgreement(uint32 id) external view returns (ForestCommon.Agreement memory) {
        return agreements[id];
    }

    /// @notice Gets all Provider IDs in the Protocol
    /// @return provIds Array of Provider IDs
    function getAllProviderIds() external view returns (uint24[] memory) {
        return provIds;
    }

    /// @notice Gets all Validator IDs in the Protocol
    /// @return valIds Array of Validator IDs
    function getAllValidatorIds() external view returns (uint24[] memory) {
        return valIds;
    }

    /// @notice Gets the total revenue in this Protocol for Providers
    /// @return activeAgreementsValue Total revenue in this Protocol for Providers
    function getActiveAgreementsValue() external view returns (uint) {
        return activeAgreementsValue;
    }

    /// @notice Gets the outstanding reward for an Agreement
    /// @dev There is an assumption that the Agreement can't be paused
    /// @param _agreementId ID of the Agreement to get the outstanding reward for
    /// @return outstandingRewardAmount Outstanding reward for the given Agreement
    function getOutstandingReward(
        uint32 _agreementId
    ) public view returns (uint) {
        ForestCommon.Agreement memory agreement = agreements[_agreementId];
        uint outstandingRewardAmount = (block.timestamp -
            agreement.provClaimedTs) *
            offers[agreement.offerId].fee;
        return outstandingRewardAmount;
    }

    /// @notice Gets the balance of an Agreement minus the outstanding reward
    /// @dev There is an assumption that the Agreement can't be paused
    /// @param _agreementId ID of the Agreement to get the balance for
    /// @return balance Balance of the given Agreement minus the outstanding reward
    function getBalanceMinusOutstanding(
        uint32 _agreementId
    ) public view returns (uint) {
        uint agreementBalance = agreements[_agreementId].balance;
        if (getOutstandingReward(_agreementId) > agreementBalance)
            return 0;
        else
            return agreementBalance - getOutstandingReward(_agreementId);
    }

    /// @notice Gets the balance of an Agreement
    /// @param _agreementId ID of the Agreement to get the balance for
    /// @return balance Balance of the given Agreement
    function getAgreementBalance(
        uint32 _agreementId
    ) public view returns (uint) {
        return agreements[_agreementId].balance;
    }

    /// @notice Gets the Total Value Serviced for an Actor (value of all active Agreements for the Actor)
    /// @param _actorAddr Address of the Actor to get the Total Value Serviced for
    /// @return actorTvs Total Value Serviced for the given Actor
    function getActorTvs(address _actorAddr) public view returns (uint256) {
        return actorTvs[_actorAddr];
    }

    // function isActorWhitelisted(ForestCommon.ActorType _actorType, address _actorAddr) public view returns (bool) {
    //     uint8 versionNum;
    //     uint8 whitelistedActorsCount;

    //     if (_actorType == ForestCommon.ActorType.USER) {
    //         versionNum = userWhitelistVersion;
    //         whitelistedActorsCount = userWhitelistCount;
    //     }
    //     else if (_actorType == ForestCommon.ActorType.VALIDATOR) {
    //         versionNum = validatorWhitelistVersion;
    //         whitelistedActorsCount = validatorWhitelistCount;
    //     }
    //     else if (_actorType == ForestCommon.ActorType.PROVIDER) {
    //         versionNum = providerWhitelistVersion;
    //         whitelistedActorsCount = providerWhitelistCount;
    //     }
    //     else
    //         return false;

    //     if (whitelistedActorsCount != 0) {
    //         ActorWhitelistEntry memory entry = settings.whitelistedActors[_actorAddr];
    //         if (entry.actorType == _actorType && entry.version == versionNum)
    //             return true;
    //         else
    //             return false;
    //     }

    //     return true;
    // }

    function isActorWhitelisted(address _actorAddr) public view returns (bool) {
        if (userWhitelistCount != 0) {
            if (settings.whitelistedActors[_actorAddr] == userWhitelistVersion)
                return true;
            else
                return false;
        }

        return true;
    }
}
