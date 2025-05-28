import {
  ActorType,
  ForestRegistryAddress,
  ForestSlasherAddress,
  ForestTokenAddress,
  Status,
} from "@/constants";
import { InvalidChain } from "@/errors";
import { ContractAddresses, ForestChain } from "@/types";
import { Chain } from "viem";
import { anvil, optimism, optimismSepolia, base, baseSepolia } from "viem/chains";

/**
 * Gets address of a smart contract for different chains
 */
export function getContractAddressByChain<T extends ContractAddresses>(
  chain: ForestChain | Chain,
  addresses: T
): T[keyof T] {
  if (typeof chain === "string") {
    switch (chain) {
      case "anvil":
        return addresses.Local as T[keyof T];
      case "optimism":
        return addresses.OptimismMainnet as T[keyof T];
      case "optimism-sepolia":
        return addresses.OptimismTestnet as T[keyof T];
      case "base":
        return addresses.BaseMainnet as T[keyof T];
      case "base-sepolia":
        return addresses.BaseTestnet as T[keyof T];
    }
  } else {
    switch (chain.id) {
      case anvil.id:
        return addresses.Local as T[keyof T];
      case optimism.id:
        return addresses.OptimismMainnet as T[keyof T];
      case optimismSepolia.id:
        return addresses.OptimismTestnet as T[keyof T];
      case base.id:
        return addresses.BaseMainnet as T[keyof T];
      case baseSepolia.id:
        return addresses.BaseTestnet as T[keyof T];
    }
  }

  throw new InvalidChain(chain);
}

/**
 * Returns Forest Registry address for different chains.
 * @param chain
 * @deprecated Use `getContractAddress` instead
 */
export function getForestRegistryAddress(chain: ForestChain) {
  switch (chain) {
    case "anvil":
      return ForestRegistryAddress.Local;
    case "optimism":
      return ForestRegistryAddress.OptimismMainnet;
    case "optimism-sepolia":
      return ForestRegistryAddress.OptimismTestnet;
    case "base":
      return ForestRegistryAddress.BaseMainnet;
    case "base-sepolia":
      return ForestRegistryAddress.BaseTestnet;
  }
}

/**
 * Returns Forest Token address for different chains.
 * @param chain
 * @deprecated Use `getContractAddress` instead
 */
export function getForestTokenAddress(chain: ForestChain) {
  switch (chain) {
    case "anvil":
      return ForestTokenAddress.Local;
    case "optimism":
      return ForestTokenAddress.OptimismMainnet;
    case "optimism-sepolia":
      return ForestTokenAddress.OptimismTestnet;
    case "base":
      return ForestTokenAddress.BaseMainnet;
    case "base-sepolia":
      return ForestTokenAddress.BaseTestnet;
  }
}

/**
 * Returns Forest Slasher contract address for different chains.
 * @param chain
 * @deprecated Use `getContractAddress` instead
 */
export function getSlasherContractAddress(chain: ForestChain) {
  switch (chain) {
    case "anvil":
      return ForestSlasherAddress.Local;
    case "optimism":
      return ForestSlasherAddress.OptimismMainnet;
    case "optimism-sepolia":
      return ForestSlasherAddress.OptimismTestnet;
    case "base":
      return ForestSlasherAddress.BaseMainnet;
    case "base-sepolia":
      return ForestSlasherAddress.BaseTestnet;
  }
}

/**
 * Converts `ForestChain` into Viem chain.
 * @param chain
 */
export function forestChainToViemChain(chain: Chain | ForestChain) {
  if (typeof chain === "object") return chain;

  const viemChain = {
    anvil: anvil,
    optimism: optimism,
    "optimism-sepolia": optimismSepolia,
    base: base,
    "base-sepolia": baseSepolia,
  }[chain];

  if (!viemChain) {
    throw new InvalidChain(chain);
  }

  return viemChain;
}

/**
 * Converts a usable Viem chain into ForestChain type.
 * @param chain
 */
export function viemChainToForestChain(chain: Chain): ForestChain {
  switch (chain.id) {
    case anvil.id:
      return "anvil";
    case optimism.id:
      return "optimism";
    case optimismSepolia.id:
      return "optimism-sepolia";
    case base.id:
      return "base";
    case baseSepolia.id:
      return "base-sepolia";
  }

  throw new InvalidChain(chain.id);
}

/**
 * Converts an actor type into a human readable string.
 * @param actor
 * @returns
 */
export function actorTypeToString(actor: ActorType) {
  switch (actor) {
    case ActorType.None:
      return "None";
    case ActorType.Provider:
      return "Provider";
    case ActorType.Validator:
      return "Validator";
    case ActorType.ProtocolOwner:
      return "Protocol Owner";
  }
}

/**
 * Converts Status enum into a string
 */
export function statusToString(status: Status) {
  switch (status) {
    case Status.None:
      return "None";
    case Status.NotActive:
      return "Not Active";
    case Status.Active:
      return "Active";
  }
  return `${status}`;
}
