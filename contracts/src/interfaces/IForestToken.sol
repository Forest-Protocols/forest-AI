// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

interface IForestToken {
    error ECDSAInvalidSignature();
    error ECDSAInvalidSignatureLength(uint256 length);
    error ECDSAInvalidSignatureS(bytes32 s);
    error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed);
    error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed);
    error ERC20InvalidApprover(address approver);
    error ERC20InvalidReceiver(address receiver);
    error ERC20InvalidSender(address sender);
    error ERC20InvalidSpender(address spender);
    error ERC2612ExpiredSignature(uint256 deadline);
    error ERC2612InvalidSigner(address signer, address owner);
    error EnforcedPause();
    error EpochNotClosed();
    error EpochRewardAlreadyEmitted();
    error ExpectedPause();
    error InvalidAccountNonce(address account, uint256 currentNonce);
    error InvalidAddress();
    error InvalidParam();
    error InvalidShortString();
    error OwnableInvalidOwner(address owner);
    error OwnableUnauthorizedAccount(address account);
    error StringTooLong(string str);

    event Approval(address indexed owner, address indexed spender, uint256 value);
    event EIP712DomainChanged();
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Paused(address account);
    event RewardsMinted(
        uint256 indexed epoch, address indexed ptAddr, uint256 revenueAtEpochClose, uint256 totalTokensEmitted
    );
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Unpaused(address account);

    function BLOCK_TIME() external view returns (uint256);
    function DOMAIN_SEPARATOR() external view returns (bytes32);
    function HALVING_INTERVAL() external view returns (uint256);
    function INITIAL_EMISSION() external view returns (uint256);
    function NO_VALIDATOR_PUNISHMENT_ADJUSTMENT() external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function burn(uint256 value) external;
    function burnFrom(address account, uint256 value) external;
    function calculateCurrentEmissionAmount() external view returns (uint256);
    function decimals() external view returns (uint8);
    function eip712Domain()
        external
        view
        returns (
            bytes1 fields,
            string memory name,
            string memory version,
            uint256 chainId,
            address verifyingContract,
            bytes32 salt,
            uint256[] memory extensions
        );
    function emitRewards(uint256 _epoch) external;
    function getLastEmissionsBlockNum() external view returns (uint256);
    function getLastEmittedEpochBlockNum() external view returns (uint256);
    function getRegistryAddr() external view returns (address);
    function getSlasherAddr() external view returns (address);
    function isRewardEmitted(uint256 _epoch) external view returns (bool);
    function name() external view returns (string memory);
    function nonces(address owner) external view returns (uint256);
    function onlyWhenRegistryAndSlasherSet() external view;
    function owner() external view returns (address);
    function pause() external;
    function paused() external view returns (bool);
    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        external;
    function renounceOwnership() external;
    function setNoValidatorPunishmentAdjustment(uint256 _noValidatorPunishmentAdjustment) external;
    function setRegistryAndSlasherAddr(address _registryAddr) external;
    function startingBlockNum() external view returns (uint256);
    function symbol() external view returns (string memory);
    function totalSupply() external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function transferOwnership(address newOwner) external;
    function unpause() external;
}
