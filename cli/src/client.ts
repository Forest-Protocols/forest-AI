import {
  ForestPublicClientType,
  IndexerClient,
  Protocol,
  Registry,
  Slasher,
  Token,
} from "@forest-protocols/sdk";
import { Account, Address } from "viem";
import { config } from "@/config";

export function createRegistryInstance(
  client: ForestPublicClientType,
  account?: Account
) {
  return new Registry({
    client,
    account,
    address: config.registryAddress.value,
  });
}

export function createProtocolInstance(
  client: ForestPublicClientType,
  ptAddress: Address,
  account?: Account
) {
  return new Protocol({
    client,
    account,
    address: ptAddress,
    registryContractAddress: config.registryAddress.value,
  });
}

export function createSlasherInstance(
  client: ForestPublicClientType,
  account?: Account
) {
  return new Slasher({
    client,
    account,
    address: config.slasherAddress.value,
    registryContractAddress: config.registryAddress.value,
  });
}

export function createTokenInstance(
  client: ForestPublicClientType,
  account?: Account
) {
  return new Token({
    client,
    account,
    address: config.tokenAddress.value,
  });
}

export const indexerClient = new IndexerClient({
  baseURL: config.indexerAPI.value,
});
