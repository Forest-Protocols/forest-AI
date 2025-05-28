import {
  Address,
  GetContractReturnType,
  HttpTransport,
  PublicClient,
  WalletClient,
} from "viem";
import { ActorType, Status } from "./constants";
import { RegistryABI } from "./blockchain/abi/registry";
import { ProtocolABI } from "./blockchain/abi/protocol";
import { ForestTokenABI } from "./blockchain/abi/forest-token";
import { SlasherABI } from "./blockchain/abi/slasher";
import {
  OfferDetailsSchema,
  ProtocolDetailsSchema,
  ProtocolOfferParamsSchema,
  OfferParamSchema,
  ActorDetailsSchema,
} from "./validation";
import { z } from "zod";

export type Offer = {
  // ID of of the resource offer
  id: number;

  // Provider of this resource offer
  ownerAddr: Address;

  // Price per second in USDC
  fee: bigint;

  // How many resource can be created from this resource offer?
  stockAmount: number;

  // CID of the file that provides more information about the offer.
  detailsLink: string;

  // Active agreement count that uses this offer.
  activeAgreements: number;

  // Status of the offer
  status: Status;

  // Timestamp when the offer is closed for new purchases
  closeRequestTs: bigint;
};

export type Agreement = {
  // ID of of the resource
  id: number;

  // ID of the offer that this resource associated to
  offerId: number;

  // The agreement balance deposited from the user
  balance: bigint;

  // Owner of the resource
  userAddr: Address;

  // Timestamp of the start of the agreement
  startTs: bigint;

  // Timestamp of the end of the agreement
  endTs: bigint;

  // The amount that claimed by the provider of this agreement
  provClaimedAmount: bigint;

  // Last timestamp the provider claimed payment from the agreement's balance
  provClaimedTs: bigint;

  // Status of the agreement
  status: Status;
};

/**
 * Viem client types
 */
export type ForestPublicClientType = PublicClient<HttpTransport, any, any>;
export type ForestWalletClientType = WalletClient<HttpTransport, any, any>;

/**
 * Forest registry smart contract type
 */
export type RegistryContractType = GetContractReturnType<
  typeof RegistryABI,
  ForestPublicClientType
>;

/**
 * FOREST token smart contract type
 */
export type ForestTokenContractType = GetContractReturnType<
  typeof ForestTokenABI,
  ForestPublicClientType
>;

/**
 * Protocol smart contract type
 */
export type ProtocolContractType = GetContractReturnType<
  typeof ProtocolABI,
  ForestPublicClientType
>;

/**
 * Forest slasher smart contract type
 */
export type SlasherContractType = GetContractReturnType<
  typeof SlasherABI,
  ForestPublicClientType
>;

/**
 * String representation of supported blockchains by Forest Network
 */
export type ForestChain =
  | "anvil"
  | "optimism"
  | "optimism-sepolia"
  | "base"
  | "base-sepolia";

/**
 * An actor, represents different players in Forest Network
 * such as Provider, Validator and Protocol Owner.
 */
export type Actor = {
  id: number;
  registrationTs: bigint;
  status: Status;
  actorType: ActorType;
  ownerAddr: Address;
  operatorAddr: Address;
  billingAddr: Address;
  detailsLink: string;
};

/**
 * Alias for `Actor` type
 */
export type Provider = Actor;

/**
 * Alias for `Actor` type
 */
export type Validator = Actor;

/**
 * Alias for `Actor` type
 */
export type ProtocolOwner = Actor;

export type ActorDetails = z.infer<typeof ActorDetailsSchema>;

/**
 * Alias for `ActorDetails` type
 */
export type ProviderDetails = z.infer<typeof ActorDetailsSchema>;

/**
 * Alias for `ActorDetails` type
 */
export type ValidatorDetails = z.infer<typeof ActorDetailsSchema>;

/**
 * Alias for `ActorDetails` type
 */
export type ProtocolOwnerDetails = z.infer<typeof ActorDetailsSchema>;

export type ProtocolDetails = z.infer<typeof ProtocolDetailsSchema>;

export type ProtocolOfferParamDefinition = z.infer<
  typeof ProtocolOfferParamsSchema
>;

/**
 * On-chain protocol settings and information
 */
export type ProtocolInfo = {
  contractAddress: Address;
  ownerAddress: Address;
  agreementCount: bigint;
  providerIds: number[];
  validatorIds: number[];
  detailsLink: string;
  emissionShares: {
    provider: number;
    validator: number;
    pcOwner: number;
  };
  registrationFees: {
    provider: bigint;
    validator: bigint;
    offer: bigint;
  };
  maxActorCount: {
    provider: bigint;
    validator: bigint;
  };
  minCollateral: bigint;
  offersCount: bigint;
  termUpdateDelay: bigint;
};

/**
 * Forest Registry settings/params
 */
export type RegistryInfo = {
  totalActorCount: bigint;
  totalProvidersCount: bigint;
  totalValidatorsCount: bigint;
  totalPCCount: bigint;
  maxPCCount: bigint;
  actorPCRegistrationFee: bigint;
  actorRegistrationFee: bigint;
  burnRatio: bigint;
  offerPCRegistrationFee: bigint;
  pcRegistrationFee: bigint;
  revenueShare: bigint;
  forestTokenAddress: Address;
  usdcAddress: Address;
  treasuryAddress: Address;
  slasherAddress: Address;
};

/**
 * Score of a test made by a validator for a provider.
 */
export type ProviderScore = {
  /**
   * Provider ID
   */
  provId: number;
  score: bigint;
  agreementId: number;
};

export type OfferParam = z.infer<typeof OfferParamSchema>;

export type OfferDetails = z.infer<typeof OfferDetailsSchema>;

export type ContractAddresses = {
  Local: Address;
  OptimismMainnet: Address;
  OptimismTestnet: Address;
  BaseMainnet: Address;
  BaseTestnet: Address;
};

export type MaybePromise<T> = T | Promise<T>;
