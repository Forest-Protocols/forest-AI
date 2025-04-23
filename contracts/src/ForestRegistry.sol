// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

import "./ForestProtocol.sol";
import "./interfaces/IForestProtocol.sol";
import "./interfaces/IForestToken.sol";

contract ForestRegistry is Ownable, Pausable {

    using Strings for string;

    /***********************************|
    |              Events               |
    |__________________________________*/

    event NewActorRegistered(
        ForestCommon.ActorType indexed actorType,
        address indexed ownerAddr,
        address operatorAddr,
        address billingAddr,
        string detailsLink
    );

    event NewProtocolRegistered(
        address indexed addr,
        address indexed ownerAddr,
        string detailsLink
    );

    event ActorDetailsUpdated(
        ForestCommon.ActorType indexed actorType,
        address indexed ownerAddr,
        address operatorAddr,
        address billingAddr,
        string detailsLink
    );

    event ProtocolDetailsUpdated(
        address indexed ownerAddr,
        address indexed operatorAddr,
        string detailsLink
    );

    event NetworkParamUpdated(
        string indexed paramName
    );

    event PtStatusUpdated(
        address indexed ownerAddr,
        ForestCommon.Status status
    );

    /***********************************|
    |         Network Params           |
    |__________________________________*/

    struct NetworkSettings {
        uint256 revenueShare; // percentage of USDC fees that get deducted from User payments for resources and go to the Treasury
        // TODO: uint256 stakeBasedEmissionsShare; // percentage of emisssions that get distributed based on the size of the user stake to protocols vs protocol revenue
        // TODO: uint256 lockupPeriodEmissions; // number of blocks after which emissions are allowed to be released to the Actor
        uint256 maxProtocolsNum; // maximum number of PTs allowed in the Network
        uint256 actorRegFee; // amount of FOREST tokens to be transferred to the Treasury for Actor registration in the Network
        uint256 ptRegFee; // amount of FOREST tokens to be transferred to the Treasury for PT registration in the Network
        uint256 actorInPtRegFee; // amount of FOREST tokens to be transferred to the Treasury for Actor registration in a PT. This is a Network-wide minimum fee.
        uint256 offerInPtRegFee; // amount of FOREST tokens to be transferred to the Treasury for offer registration in a PT. This is a Network-wide minimum fee.
        uint256 burnRatio; // percentage of Network earnings from registration fees that gets burned
        address treasuryAddr; // address of the Treasury
    }

    /***********************************|
    |            Variables              |
    |__________________________________*/

    address immutable ptImplementation; // address of the PT contract with the logic. When new PTs are created, a Clone of this contract is deployed that keeps track of the PT's state but uses the logic from the original PT contract.
    
    NetworkSettings settings; // current settings values for the Network

    IERC20 usdcToken; // interface object for the USDC token
    IForestToken forestToken; // interface object for the FOREST token
    address slasherAddr; // address of the Slasher contract
   
    uint24 actorIdCounter;

    mapping(address => ForestCommon.Actor) actorsMap; // map of address to Actor
    mapping(address => ForestCommon.Status) ptsMap; // map of address to PT status
    mapping(uint24 => address) actorIdToAddrMap; // map of Actor id to address

    address[] providerAddrs; // array of Provider addresses 
    address[] validatorAddrs; // array of Validator addresses
    address[] ptoAddrs; // array of Protocol Owner addresses
    address[] ptAddrs; // array of PT addresses

    /***********************************|
    |            Constructor            |
    |__________________________________*/

    constructor(
        address _slasherAddr,
        address _usdcTokenAddr,
        address _forestTokenAddr,
        uint256 _revenueShare,
        uint256 _maxProtocolsNum,
        uint256 _actorRegFee,
        uint256 _ptRegFee,
        uint256 _actorInPtRegFee,
        uint256 _offerInPtRegFee,
        address _treasuryAddr,
        uint256 _burnRatio) Ownable(_msgSender()) {
        if (_slasherAddr == address(0) || _usdcTokenAddr == address(0) || _forestTokenAddr == address(0) || _treasuryAddr == address(0))
            revert ForestCommon.InvalidAddress();
        
        slasherAddr = _slasherAddr;
        usdcToken = IERC20(_usdcTokenAddr);
        forestToken = IForestToken(_forestTokenAddr);

        ptImplementation = address(new ForestProtocol());

        settings = NetworkSettings({
            revenueShare: _revenueShare,
            maxProtocolsNum: _maxProtocolsNum,
            actorRegFee: _actorRegFee,
            ptRegFee: _ptRegFee,
            actorInPtRegFee: _actorInPtRegFee,
            offerInPtRegFee: _offerInPtRegFee,
            treasuryAddr: _treasuryAddr,
            burnRatio: _burnRatio
        });
    }

    /***********************************|
    |      Modifiers                   |
    |__________________________________*/

    // function _onlyRegisteredPt() internal view {
    //     if (ptsMap[_msgSender()] == ForestCommon.Status.NONE)
    //         revert ForestCommon.ActorNotRegisteredInRegistry();
    // }

    /***********************************|
    |      Registry Functions           |
    |__________________________________*/
    
    /// @notice Registers a new Actor in the Forest Network and pays the registration fee in FOREST token
    /// @dev Actors can be Providers, Validators, or Protocol Owners
    /// @param _actorType Type of Actor to register
    /// @param _operatorAddr (Optional) Operator address for the Actor
    /// @param _billingAddr (Optional) Billing address for the Actor
    /// @param _detailsLink Hash of the Actor details file
    /// @return id ID of the new Actor
    function registerActor(
        ForestCommon.ActorType _actorType,
        address _operatorAddr,
        address _billingAddr,
        string memory _detailsLink
    ) external whenNotPaused() returns (uint24) {
        // check if Actor is already registered
        if (actorsMap[_msgSender()].actorType != ForestCommon.ActorType.NONE)
            revert ForestCommon.ActorAlreadyRegistered();

        // handle default values for alternative addresses
        if (_billingAddr == address(0)) {
            _billingAddr = _msgSender();
        }
        if (_operatorAddr == address(0)) {
            _operatorAddr = _msgSender();
        }

        // transfer registration fee (in forest token) to the treasury
        this.transferTokensToTreasury(_msgSender(), settings.actorRegFee);

        uint24 id = actorIdCounter++;

        ForestCommon.Actor memory actor = ForestCommon.Actor(
            id,
            block.timestamp,
            ForestCommon.Status.ACTIVE,
            _actorType,
            _msgSender(),
            _operatorAddr,
            _billingAddr,
            _detailsLink
        );

        actorsMap[_msgSender()] = actor;
        actorIdToAddrMap[id] = _msgSender();
        if (_actorType == ForestCommon.ActorType.PROVIDER)
            providerAddrs.push(_msgSender());
        else if (_actorType == ForestCommon.ActorType.VALIDATOR)
            validatorAddrs.push(_msgSender());
        else 
            ptoAddrs.push(_msgSender());

         // emit an event
        emit NewActorRegistered(
            _actorType,
            _msgSender(),
            _operatorAddr,
            _billingAddr,
            _detailsLink
        );

        // return the id of the new Actor
        return id;
    }

    /// @notice Updates the details of an Actor
    /// @dev Only the Owner of the Actor can update the details
    /// @param _actorType Type of Actor to update
    /// @param _operatorAddr (Optional) New Operator address for the Actor
    /// @param _billingAddr (Optional) New Billing address for the Actor
    /// @param _detailsLink New hash of the Actor details
    function updateActorDetails(
        ForestCommon.ActorType _actorType,
        address _operatorAddr,
        address _billingAddr,
        string memory _detailsLink
    ) external {
        // check sender if he's an owner and active Actor of the given type
        if (!isRegisteredActiveActor(_actorType, _msgSender()))
            revert ForestCommon.OnlyOwnerAllowed();

        // validate params
        // handle default values for alternative addresses
        if (_billingAddr == address(0)) {
            _billingAddr = _msgSender();
        }
        if (_operatorAddr == address(0)) {
            _operatorAddr = _msgSender();
        }
        if (bytes(_detailsLink).length == 0)
            revert ForestCommon.InvalidParam();
        
        ForestCommon.Actor storage actor = actorsMap[_msgSender()];

        actor.operatorAddr = _operatorAddr;
        actor.billingAddr = _billingAddr;
        actor.detailsLink = _detailsLink;

        emit ActorDetailsUpdated(
            _actorType,
            _msgSender(),
            _operatorAddr,
            _billingAddr,
            _detailsLink
        );
    }

    // TODO: unregister an Actor whenNotPaused()

    /// @notice Creates a new Protocol by deploying a new Clone contract and initializing it with the provided parameters
    /// @dev Only registered Protocol Owners can create new Protocols
    /// @param _maxValsNum Maximum number of Validators allowed, no limit: 0, limit: >= 1
    /// @param _maxProvsNum Maximum number of Providers allowed, no limit: 0, limit: >= 1
    /// @param _minCollateral Minimum collateral required for Actors
    /// @param _valRegFee Registration fee for Validators. There might be also a Network-wide minimum fee set regardless of this fee.
    /// @param _provRegFee Registration fee for Providers. There might be also a Network-wide minimum fee set regardless of this fee.
    /// @param _offerRegFee Registration fee for offers. There might be also a Network-wide minimum fee set regardless of this fee.
    /// @param _termUpdateDelay Delay required for term updates (in seconds)
    /// @param _provShare Provider's share of rewards emitted to this PT, accepted range: 0 - 10000
    /// @param _valShare Validator's share of rewards emitted to this PT , accepted range: 0 - 10000  
    /// @param _ptoShare Protocol Owner's share of rewards emitted to this PT, accepted range: 0 - 10000
    /// @param _detailsLink Hash of the PT details file
    /// @return Address of the newly created PT
    function createProtocol(
        uint _maxValsNum,
        uint _maxProvsNum,
        uint _minCollateral,
        uint _valRegFee,
        uint _provRegFee,
        uint _offerRegFee,
        uint _termUpdateDelay,
        uint _provShare,
        uint _valShare,
        uint _ptoShare,
        string memory _detailsLink
    ) public whenNotPaused() returns (address) {
        // check sender if he's an owner and active PT_OWNER Actor
        if (!isRegisteredActiveActor(ForestCommon.ActorType.PT_OWNER, _msgSender()))
            revert ForestCommon.OnlyOwnerAllowed();
        // validate params TODO: move to PT contract specific functions
        if(_provShare + _valShare + _ptoShare != ForestCommon.HUNDRED_PERCENT_POINTS)
            revert ForestCommon.InvalidParam();
        if(bytes(_detailsLink).length == 0)
            revert ForestCommon.InvalidParam();

        // validate state against settings
        if(settings.maxProtocolsNum != 0 && settings.maxProtocolsNum <= ptAddrs.length)
            revert ForestCommon.LimitExceeded();

        // pay the registration fee
        this.transferTokensToTreasury(_msgSender(), settings.ptRegFee);

        // deploy the new product category contract using OpenZeppelin's Clones library
        address cloneAddr = Clones.clone(ptImplementation);

        // initialize the new product category contract
        IForestProtocol newProtocol = IForestProtocol(cloneAddr);
        
        newProtocol.initialize(address(this));
        newProtocol.setMaxActors(_maxValsNum, _maxProvsNum);
        newProtocol.setMinCollateral(_minCollateral);
        newProtocol.setFees(_valRegFee, _provRegFee, _offerRegFee);
        newProtocol.setTermUpdateDelay(_termUpdateDelay);
        newProtocol.setEmissionShares(_provShare, _valShare, _ptoShare);
        newProtocol.setDetailsLink(_detailsLink);

        // add the new address to the Registry
        ptAddrs.push(cloneAddr);
        ptsMap[cloneAddr] = ForestCommon.Status.NOTACTIVE;

        // unpause, change Registry state for the PT to active
        // newPt.unpause();
        ptsMap[cloneAddr] = ForestCommon.Status.ACTIVE;

        // change the owner to the sender
        newProtocol.setOwner(_msgSender());

        // emit an event
        emit NewProtocolRegistered(
            cloneAddr,
            _msgSender(),
            _detailsLink
        );

        return cloneAddr;
    }

    // TODO: unregister / delete a PT whenNotPaused()

    /***********************************|
    |       Pausable Related            |
    |__________________________________*/

    /// @notice Pauses the Registry
    function pause() external onlyOwner() {
        _pause();
    }

    /// @notice Unpauses the Registry
    function unpause() external onlyOwner() {
        _unpause(); 
    }

    // intended to be called by PT smart contract
    // function pausePt() external {
    //     _onlyRegisteredPt();
    //     if (ptsMap[_msgSender()] == ForestCommon.Status.ACTIVE) {
    //         ptsMap[_msgSender()] = ForestCommon.Status.NOTACTIVE;
    //         emit PtStatusUpdated(_msgSender(), ForestCommon.Status.NOTACTIVE);
    //     }
    //     else 
    //         revert ForestCommon.WrongState();
    // }

    // // inteded to be called by PT smart contract
    // function unpausePt() external {
    //     _onlyRegisteredPt();
    //     if (ptsMap[_msgSender()] == ForestCommon.Status.NOTACTIVE) {
    //         ptsMap[_msgSender()] = ForestCommon.Status.ACTIVE;
    //         emit PtStatusUpdated(_msgSender(), ForestCommon.Status.ACTIVE);
    //     }
    //     else 
    //         revert ForestCommon.WrongState();
    // }

    /***********************************|
    |      Helper Functions           |
    |__________________________________*/

    /// @notice Transfers tokens to the Treasury and burns a portion of it according to the burn ratio setting
    /// @param _from Address of the sender
    /// @param _amount Amount of tokens to transfer
    function transferTokensToTreasury(address _from, uint256 _amount) external {
        uint256 amountBurn = settings.burnRatio * _amount / ForestCommon.HUNDRED_PERCENT_POINTS; // assumes settings.burnRatio is in integer-based 2 decimal points precision percentage points
        uint256 amountTreasury = _amount - amountBurn;
        forestToken.transferFrom(_from, settings.treasuryAddr, amountTreasury);    
        forestToken.burnFrom(_from, amountBurn);
    }

    /// @notice Checks if an Actor is active
    /// @param _owner Owner address of the Actor
    /// @return isActive True if the Actor is active, false otherwise
    function isActiveActor(address _owner) public view returns (bool isActive) {
        return actorsMap[_owner].status == ForestCommon.Status.ACTIVE;
    }

    /// @notice Checks if an Actor is registered and active
    /// @param _actorType Type of Actor
    /// @param _owner Owner address of the Actor
    /// @return isRegistered True if the Actor is registered and active, false otherwise
    function isRegisteredActiveActor(ForestCommon.ActorType _actorType, address _owner) public view returns (bool isRegistered) {
        return isActiveActor(_owner) && actorsMap[_owner].actorType == _actorType;
    }

    /// @notice Checks if an Actor is registered and active and if the sender is the Owner or Operator of the Actor
    /// @param _actorType Type of Actor
    /// @param _owner Owner address of the Actor
    /// @param _senderAddr Sender address
    /// @return isRegistered True if the Actor is registered and active and the sender is the Owner or Operator of the Actor, false otherwise
    function isOwnerOrOperatorOfRegisteredActiveActor(ForestCommon.ActorType _actorType, address _owner, address _senderAddr) external view returns (bool isRegistered) {
        return isRegisteredActiveActor(_actorType, _owner) && (actorsMap[_owner].ownerAddr == _senderAddr || actorsMap[_owner].operatorAddr == _senderAddr);
    }

    /***********************************|
    |         Setter Functions          |
    |__________________________________*/

    /// @notice Sets the revenue share
    /// @dev Can only be called by the Owner
    /// @param _newValue New revenue share, accepted range: 0 - 10000
    function setRevenueShare(uint _newValue) external onlyOwner() {
        if (_newValue > ForestCommon.HUNDRED_PERCENT_POINTS) revert ForestCommon.InvalidParam();
        settings.revenueShare = _newValue;
        emit NetworkParamUpdated("revenueShare");
    }

    /// @notice Sets the maximum number of PTs
    /// @dev Can only be called by the Owner
    /// @param _newValue New maximum number of PTs, no limit: 0, limit: >= 1
    function setMaxProtocolsNum(uint _newValue) external onlyOwner() {
        settings.maxProtocolsNum = _newValue;
        emit NetworkParamUpdated("maxProtocolsNum");
    }

    /// @notice Sets the registration fee for Actors
    /// @dev Can only be called by the Owner
    /// @param _newValue New registration fee for Actors in FOREST tokens
    function setActorRegFee(uint _newValue) external onlyOwner() {
        settings.actorRegFee = _newValue;
        emit NetworkParamUpdated("actorRegFee");
    }

    /// @notice Sets the registration fee for PTs
    /// @dev Can only be called by the Owner
    /// @param _newValue New registration fee for PTs in FOREST tokens
    function setPtRegFee(uint _newValue) external onlyOwner() {
        settings.ptRegFee = _newValue;
        emit NetworkParamUpdated("ptRegFee");
    }

    /// @notice Sets the registration fee for Actors in PTs
    /// @dev Can only be called by the Owner
    /// @param _newValue New registration fee for Actors in PTs in FOREST tokens
    function setActorInPtRegFee(uint _newValue) external onlyOwner() {
        settings.actorInPtRegFee = _newValue;
        emit NetworkParamUpdated("actorInPtRegFee");
    }

    /// @notice Sets the registration fee for offers in PTs
    /// @dev Can only be called by the Owner
    /// @param _newValue New registration fee for offers in PTs in FOREST tokens
    function setOfferInPtRegFee(uint _newValue) external onlyOwner() {
        settings.offerInPtRegFee = _newValue;
        emit NetworkParamUpdated("offerInPtRegFee");
    }

    /// @notice Sets the burn ratio
    /// @dev Can only be called by the Owner
    /// @param _newValue New burn ratio, accepted range: 0 - 10000
    function setBurnRatio(uint _newValue) external onlyOwner() {
        if (_newValue > ForestCommon.HUNDRED_PERCENT_POINTS) revert ForestCommon.InvalidParam();
        settings.burnRatio = _newValue;
        emit NetworkParamUpdated("burnRatio");
    }

    /// @notice Sets the treasury address
    /// @dev Can only be called by the Owner
    /// @param _newValue New treasury address
    function setTreasuryAddrParam(address _newValue) external onlyOwner() {
        settings.treasuryAddr = _newValue;
        emit NetworkParamUpdated("treasuryAddr");
    }

    /// @notice Sets the slasher address
    /// @dev Can only be called by the Owner
    /// @param _newValue New slasher address (can't be zero address)
    function setSlasherAddress(address _newValue) external onlyOwner() {
        if (_newValue == address(0))
            revert ForestCommon.InvalidAddress();
        
        slasherAddr = _newValue;
        emit NetworkParamUpdated("slasherAddr");
    }

    /// @notice Sets the USDC token address
    /// @dev Can only be called by the Owner
    /// @param _newValue New USDC token address (can't be zero address)
    function setUsdcTokenAddress(address _newValue) external onlyOwner() {
        if (_newValue == address(0))
            revert ForestCommon.InvalidAddress();
        usdcToken = IERC20(_newValue);
        emit NetworkParamUpdated("usdcToken");
    }

    /// @notice Sets the Forest token address
    /// @dev Can only be called by the Owner
    /// @param _newValue New Forest token address (can't be zero address)
    function setForestTokenAddress(address _newValue) external onlyOwner() {
        if (_newValue == address(0))
            revert ForestCommon.InvalidAddress();
        forestToken = IForestToken(_newValue);
        emit NetworkParamUpdated("forestToken");
    }

    /***********************************|
    |         Getter Functions          |
    |__________________________________*/

    /// @notice Gets all Protocol Owners
    /// @return _owners Array of all Protocol Owners
    function getAllPtos() external view returns (ForestCommon.Actor[] memory) {
        ForestCommon.Actor[] memory _owners = new ForestCommon.Actor[](ptoAddrs.length);
        for (uint256 i = 0; i < ptoAddrs.length; i++) {
            _owners[i] = actorsMap[ptoAddrs[i]];
        }
        return _owners;
    }
    
    /// @notice Gets all Providers
    /// @return _providers Array of all Providers
    function getAllProviders() external view returns (ForestCommon.Actor[] memory) {
        ForestCommon.Actor[] memory _providers = new ForestCommon.Actor[](providerAddrs.length);

        for (uint256 i = 0; i < providerAddrs.length; i++) {
            _providers[i] = actorsMap[providerAddrs[i]];
        }
        return _providers;
    }

    /// @notice Gets the number of Providers
    /// @return _providersCount Number of Providers
    function getProvidersCount() external view returns (uint256) {
        return providerAddrs.length;
    }

    /// @notice Gets all PT addresses
    /// @return _ptAddrs Array of all PT addresses
    function getAllPtAddresses() external view returns (address[] memory) {
        return ptAddrs;
    }

    /// @notice Gets the number of PTs
    /// @return _ptCount Number of PTs
    function getPtCount() external view returns (uint256) {
        return ptAddrs.length;
    }

    /// @notice Checks if a PT is registered and active
    /// @param _addr Address of the PT
    /// @return isRegistered True if the PT is registered and active, false otherwise
    function isPtRegisteredAndActive(address _addr) external view returns (bool) {
        return ptsMap[_addr] == ForestCommon.Status.ACTIVE;
    }

    /// @notice Gets all Validators
    /// @return _validators Array of all Validators
    function getAllValidators() external view returns (ForestCommon.Actor[] memory) {
        ForestCommon.Actor[] memory _validators = new ForestCommon.Actor[](
            validatorAddrs.length
        );
        for (uint256 i = 0; i < validatorAddrs.length; i++) {
            _validators[i] = actorsMap[validatorAddrs[i]];
        }
        return _validators;
    }

    /// @notice Gets the number of Validators
    /// @return _validatorsCount Number of Validators
    function getValidatorsCount() external view returns (uint256) {
        return validatorAddrs.length;
    }

    /// @notice Gets an Actor by address
    /// @param _addr Owner address of the Actor
    /// @return _actor Actor
    function getActor(address _addr)  external view returns (ForestCommon.Actor memory) {
        return actorsMap[_addr];
    }

    /// @notice Gets the number of Actors (Providers, Validators, and Protocol Owners)
    /// @return _actorCount Number of Actors
    function getActorCount() external view returns (uint256) {
        return providerAddrs.length + validatorAddrs.length + ptoAddrs.length;
    }

    /// @notice Gets the revenue share
    /// @return _revenueShare Revenue share 
    function getRevenueShare() external view returns (uint256) {
        return settings.revenueShare;
    }

    /// @notice Gets the maximum number of PTs
    /// @return _maxPtsNum Maximum number of PTs
    function getMaxProtocolsNum() external view returns (uint256) {
        return settings.maxProtocolsNum;
    }

    /// @notice Gets the registration fee for Actors 
    /// @return _actorRegFee Registration fee for Actors in FOREST tokens
    function getActorRegFee() external view returns (uint256) {
        return settings.actorRegFee;
    }

    /// @notice Gets the registration fee for PTs
    /// @return _ptRegFee Registration fee for PTs in FOREST tokens
    function getPtRegFee() external view returns (uint256) {
        return settings.ptRegFee;
    }

    /// @notice Gets the registration fee for Actors in PTs
    /// @return _actorInPtRegFee Registration fee for Actors in PTs in FOREST tokens
    function getActorInPtRegFee() external view returns (uint256) {
        return settings.actorInPtRegFee;
    }

    /// @notice Gets the registration fee for offers in PTs
    /// @return _offerInPtRegFee Registration fee for offers in PTs in FOREST tokens
    function getOfferInPtRegFee() external view returns (uint256) {
        return settings.offerInPtRegFee;
    }

    /// @notice Gets the burn ratio
    /// @return _burnRatio Burn ratio
    function getBurnRatio() external view returns (uint256) {
        return settings.burnRatio;
    }

    /// @notice Gets the Treasury address
    /// @return _treasuryAddr Treasury address
    function getTreasuryAddr() external view returns (address) {
        return settings.treasuryAddr;
    }

    /// @notice Gets the Forest token address
    /// @return _forestTokenAddr Forest token address
    function getForestTokenAddr() external view returns (address) {
        return address(forestToken);
    }

    /// @notice Gets the USDC token address
    /// @return _usdcTokenAddr USDC token address
    function getUsdcTokenAddr() external view returns (address) {
        return address(usdcToken);
    }

    /// @notice Gets the Slasher address
    /// @return _slasherAddr Slasher address
    function getSlasherAddr() external view returns (address) {
        return slasherAddr;
    }

    /// @notice Gets an Actor by ID
    /// @param _id ID of the Actor
    /// @return _actor Actor
    function getActorById(uint24 _id) external view returns (ForestCommon.Actor memory) {
        return actorsMap[actorIdToAddrMap[_id]];
    }

    /// @notice Gets the billing address of an Actor by ID
    /// @param _id ID of the Actor
    /// @return _billingAddr Billing address
    function getActorBillingAddressById(uint24 _id) external view returns (address) {
        return actorsMap[actorIdToAddrMap[_id]].billingAddr;
    }
}
