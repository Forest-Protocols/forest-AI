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
  OptimismTestnet = "0x2dF5969aE1eACAbE5e911F49Eb07f9Ce900942dB", // v0.44
  // eslint-disable-next-line @typescript-eslint/no-duplicate-enum-values
  BaseMainnet = "0x", // v0.45
  BaseTestnet = "0x2F1c43d20E8A99DE2fb4e3375aDd29fbD1e5Eff0", // v0.45
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
  OptimismTestnet = "0xF52A100Ae7ddB4aC9d6dB508C9DF9c7613CAe06E", // v0.44
  // eslint-disable-next-line @typescript-eslint/no-duplicate-enum-values
  BaseMainnet = "0x", // v0.45
  BaseTestnet = "0x7d9A7D5F382E71AaCab227D96B9cd95218E36f30", // v0.45
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
  OptimismTestnet = "0xE5baE709081755Dc97aDd9c40ab4bFF505eC0D2c", // v0.44
  // eslint-disable-next-line @typescript-eslint/no-duplicate-enum-values
  BaseMainnet = "0x", // v0.45
  BaseTestnet = "0x86d45E437238c8aCAD8C37e7D6A4f86C3335d34b", // v0.45
}

/**
 * Points to the Mocked USDf for Testnet and USDC for mainnet
 */
export enum USDCAddress {
  /**
   * Anvil local blockchain.
   */
  Local = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  OptimismMainnet = "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  OptimismTestnet = "0x8A278cc8f4c0c8A93B322b5461153fAcf4121112",
  BaseMainnet = "0x", // v0.45
  BaseTestnet = "0xC80ca08851aE3F9d947eb78E1E2d810556AF1303", // v0.45
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
export const MONTH_IN_SECONDS = 2635200n;
export const HUNDRED_PERCENT_POINTS = 10000n;
export const NO_VALIDATOR_PUNISHMENT_ADJUSTMENT = 7000n;
