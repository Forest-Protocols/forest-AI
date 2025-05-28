import { NotInitialized } from "@/errors";
import {
  ContractAddresses,
  ForestChain,
  ForestPublicClientType,
} from "@/types";
import {
  forestChainToViemChain,
  getContractAddressByChain,
  httpTransport,
  writeContract,
} from "@/utils";
import {
  Abi,
  Account,
  Address,
  Chain,
  createPublicClient,
  getContract,
  GetContractReturnType,
  WriteContractParameters,
} from "viem";

export type ContractClientOptions = {
  address?: Address;
  signal?: AbortSignal;
  account?: Account;
} & (
  | {
      rpcHost: string;
      chain: Chain | ForestChain;
      client?: undefined;
    }
  | {
      rpcHost?: undefined;
      chain?: undefined;
      client: ForestPublicClientType;
    }
);

export class ContractClient<K extends Abi | readonly unknown[] = Abi> {
  account?: Account;
  contract: GetContractReturnType<K, ForestPublicClientType>;
  client: ForestPublicClientType;
  address: Address;
  signal?: AbortSignal;

  constructor(
    contractAbi: K,
    options: ContractClientOptions & {
      addresses?: ContractAddresses;
    }
  ) {
    if (options.client === undefined && options.chain === undefined) {
      throw new Error("Chain has to be defined for client initialization");
    }

    if (options.client) {
      this.client = options.client;
    } else {
      const chain = forestChainToViemChain(options.chain);
      this.client = createPublicClient({
        chain,
        transport: httpTransport(chain, options.rpcHost, options.signal),
      });
    }

    // If address of the contract is given, use it
    if (options.address) {
      this.address = options.address;
    } else if (options.addresses) {
      // Otherwise try to find default address based on the given addresses and chain
      this.address = getContractAddressByChain(
        this.client.chain,
        options.addresses
      );
    } else {
      // Please give me the address of that contract!
      throw new Error(`Contract address is undefined`);
    }

    this.contract = getContract({
      address: this.address,
      abi: contractAbi,
      client: this.client,
    });

    this.account = options.account;
    this.signal = options.signal;
  }

  /**
   * Wraps `writeContract` function with the options that defined for this object
   */
  protected async writeContract<T extends Abi>(
    request: WriteContractParameters<T>,
    options?: {
      retryDelay?: number;
      timeout?: number;
    }
  ) {
    return await writeContract(this.client, request, {
      ...options,
      signal: this.signal,
    });
  }

  protected checkAccount() {
    if (!this.account) {
      throw new NotInitialized("Account");
    }
  }
}
