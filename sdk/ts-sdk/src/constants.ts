export enum ErrorCode {
  InvalidChain = 1,
  ContractNotFound,
  InsufficientAllowance,
  InsufficientBalance,
}

/**
 * Smart contract addresses of Forest Registry in different chains.
 */
export enum ForestRegistryAddress {
  /**
   * Anvil local blockchain.
   */
  Local = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
  OptimismMainnet = "0x",
  OptimismTestnet = "0xfd57c88098550f2929c1200400Cf611Be207eBC4", // v0.22
}

/**
 * Official FOREST token addresses in different chains.
 */
export enum ForestTokenAddress {
  /**
   * Anvil local blockchain.
   */
  Local = "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  OptimismMainnet = "0x",
  OptimismTestnet = "0x3b494BcC7c9dE07610269eFE0305f2906845E2e7", // v0.22
}

/**
 * Forest Slasher smart contract addresses in different chains.
 */
export enum ForestSlasherAddress {
  /**
   * Anvil local blockchain.
   */
  Local = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  OptimismMainnet = "0x",
  OptimismTestnet = "0xbC970527ac59E19DD12D4b4F69627e9eC354E848", // v0.22
}

export enum USDCAddress {
  /**
   * Anvil local blockchain.
   */
  Local = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  OptimismMainnet = "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  OptimismTestnet = "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
}

/**
 * Deployment status of a resource.
 */
export enum DeploymentStatus {
  Deploying = "Deploying",
  Closed = "Closed",
  Running = "Running",
  Unknown = "Unknown",
  Failed = "Failed",
}

/**
 * Role of an actor in the protocol.
 */
export enum ActorType {
  None = 0,
  Provider,
  Validator,
  ProtocolOwner,
}

/**
 * Status of an entity such as Agreement, Offer, Provider, Validator etc.
 */
export enum Status {
  None = 0,
  NotActive,
  Active,
}

/**
 * Some known error signatures of the smart contracts.
 */
export enum BlockchainErrorSignatures {
  ERC20InsufficientAllowance = "0xfb8f41b2",
  ERC20InsufficientBalance = "0xe450d38c",
}

/**
 * Fixed decimal number of the known tokens
 */
export enum DECIMALS {
  USDC = 6,
  FOREST = 18,
}

/**
 * Status of a commit that written on blockchain.
 */
export enum CommitStatus {
  None = 0,
  Committed,
  Revealed,
}

/**
 * Zero address representation.
 */
export const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";
