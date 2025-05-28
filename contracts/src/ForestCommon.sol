// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

library ForestCommon {

    /***********************************|
    |         Consts & Enums            |
    |__________________________________*/

    // the below assume two decimals 100.00, so 1 is 0.01, 100 is 1.00, 1000 is 10.00, 10000 is 100.00 percent
    uint256 public constant HUNDRED_PERCENT_POINTS = 10000;

    enum Status {
        NONE,
        NOTACTIVE,
        ACTIVE
    }

    enum ActorType {
        NONE,
        PROVIDER,
        VALIDATOR,
        PT_OWNER,
        USER
    }

    /***********************************|
    |              Structs              |
    |__________________________________*/

    struct Offer {
        uint32 id;
        Status status;
        // parameters set by Provider
        address ownerAddr;
        uint256 fee;
        uint256 closeRequestTs;
        uint24 stockAmount; 
        string detailsLink;
        // stats
        uint32 activeAgreements;
    }

    struct Agreement {
        uint32 id;
        uint32 offerId;
        address userAddr;
        uint256 balance;
        uint256 startTs;
        uint256 endTs;
        uint256 provClaimedAmount;
        uint256 provClaimedTs;
        Status status;
    }

    struct Actor {
        uint24 id;
        uint256 registrationTs;
        Status status;
        ActorType actorType;
        address ownerAddr;
        // parameters set by Provider
        address operatorAddr;
        address billingAddr;
        string detailsLink;
    }

    /***********************************|
    |              Errors               |
    |__________________________________*/

    // Access & Authorization
    /// @dev Thrown when sender is not authorized for the operation
    error Unauthorized();                    
    /// @dev Thrown when sender is not the Actor's Owner or when sender is not the Owner of the agreement
    error OnlyOwnerAllowed();               
    /// @dev Thrown when sender is not a registered Owner or Operator of the specified Actor
    error OnlyOwnerOrOperatorAllowed();       
    /// @dev Thrown when sender is not whitelisted for the operation
    error NotWhitelisted();

    // Actor Management
    /// @dev Thrown when attempting to access an unregistered Actor
    error ActorNotRegistered();             
    /// @dev Thrown when attempting to register an already registered Actor
    error ActorAlreadyRegistered();         
    /// @dev Thrown when Actor type is invalid for the operation
    error ActorWrongType();                       

    // State & Validation
    /// @dev Thrown when operation is invalid in current state
    error InvalidState();                    
    /// @dev Thrown when function parameter is invalid
    error InvalidParam();                    
    /// @dev Thrown when amount is insufficient for operation
    error InsufficientAmount();             
    /// @dev Thrown when address is invalid (e.g., zero address)
    error InvalidAddress();      
    /// @dev Thrown when maximum threshold is reached
    error LimitExceeded();             

    // Business Logic
    /// @dev Thrown when attempting to submit an already submitted commitment
    error CommitmentAlreadySubmitted();      
    /// @dev Thrown when attempting to submit a reveal that points to a commitment that doesn't exist
    error CommitmentNotSubmitted();   
    /// @dev Throw when object doesn't belong to the Actor
    error ProviderDoesNotMatchAgreement(uint24 _providerId, uint32 _agreementId);
    /// @dev Thrown when Validator does not match agreement
    error ValidatorDoesNotMatchAgreement(uint24 _validatorId, uint32 _agreementId);
    /// @dev Thrown when object is not in active state
    error ObjectNotActive();    
    /// @dev Thrown when object is in active state
    error ObjectActive();              
    /// @dev Thrown when attempting to access unclosed epoch
    error EpochNotClosed();                  
    /// @dev Thrown when rewards for epoch were already emitted
    error EpochRewardAlreadyEmitted();       

    // OZ Pausable 
    /// @dev Thrown when contract is paused
    error EnforcedPause();
    /// @dev Thrown when contract is not paused
    error ExpectedPause();
}