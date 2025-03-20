import {
  ForestChain,
  ForestPublicClientType,
  ForestTokenContractType,
  ForestWalletClientType,
} from "@/types";
import {
  forestChainToViemChain,
  getContractAddressByChain,
  viemChainToForestChain,
} from "@/utils";
import {
  Account,
  Address,
  createPublicClient,
  createWalletClient,
  formatEther,
  getContract,
  http,
} from "viem";
import { ForestTokenABI } from "./abi/forest-token";
import { NotInitialized } from "@/errors";
import { ForestTokenAddress } from "@/constants";
import { httpTransport } from "@/utils/viem";

export type TokenClientOptions = {
  contractAddress?: Address;
};

export class Token {
  protected publicClient!: ForestPublicClientType;
  protected contract!: ForestTokenContractType;
  protected account?: Account;
  protected walletClient?: ForestWalletClientType;

  private constructor() {}

  /**
   * Creates a Token instance for Forest Token contract.
   * @param chain
   * @param rpcHost
   * @param account
   */
  static create(
    chain: ForestChain,
    rpcHost: string,
    account?: Account,
    options?: TokenClientOptions
  ) {
    const token = new Token();

    token.publicClient = createPublicClient({
      chain: forestChainToViemChain(chain),
      transport: httpTransport(chain, rpcHost),
    });
    token.account = account;
    token.setupContracts(chain, options);

    return token;
  }

  static createWithClient(
    client: ForestPublicClientType,
    account?: Account,
    options?: TokenClientOptions
  ) {
    const token = new Token();
    const forestChain = viemChainToForestChain(client.chain);

    token.publicClient = client;
    token.account = account;
    token.setupContracts(forestChain, options);

    return token;
  }

  /**
   * Makes the calculations and distribute the rewards between PC owners, Providers and Validators.
   * It can be called by anyone who registered in the protocol. The epoch has to be via `slasher.closeEpoch`
   * before calling this function.
   * @param epoch Epoch for calculating rewards. Rewards can be distributed only once per epoch.
   */
  async emitRewards(epoch: bigint) {
    this.checkAccount();
    await this.contract.write.emitRewards([epoch], {
      account: this.account!,
      chain: this.publicClient!.chain,
    });
  }

  /**
   * Sets allowance for a spender address.
   * @param spender
   * @param amount
   */
  async setAllowance(spender: Address, amount: bigint) {
    this.checkAccount();

    await this.contract!.write.approve([spender, amount], {
      account: this.account!,
      chain: this.publicClient!.chain,
    });
  }

  /**
   * Get decimals of the token.
   */
  async getDecimals(): Promise<number> {
    return await this.contract.read.decimals();
  }

  /**
   * Pauses the token contract. Only can be called by the Admin.
   */
  async pause() {
    this.checkAccount();
    await this.contract.write.pause({
      account: this.account!,
      chain: this.publicClient.chain,
    });
  }

  /**
   * Unpauses the token contract. Only can be called by the Admin.
   */
  async unpause() {
    this.checkAccount();
    await this.contract.write.unpause({
      account: this.account!,
      chain: this.publicClient.chain,
    });
  }

  /**
   * Reads the allowance amount for a spender.
   * @param owner
   * @param spender
   * @param format If it is true, formats the balance.
   */
  async getAllowance(
    owner: Address,
    spender: Address,
    format: true
  ): Promise<string>;
  async getAllowance(
    owner: Address,
    spender: Address,
    format?: false
  ): Promise<bigint>;
  async getAllowance(
    owner: Address,
    spender: Address,
    format: boolean = false
  ): Promise<string | bigint> {
    const amount = await this.contract.read.allowance([owner, spender]);

    if (format) {
      return formatEther(amount);
    }
    return amount;
  }

  /**
   * Reads the balance of an account.
   * @param owner
   * @param format If it is true, formats the balance.
   */
  async getBalance(owner: Address, format: true): Promise<string>;
  async getBalance(owner: Address, format?: false): Promise<bigint>;
  async getBalance(owner: Address, format: boolean = false) {
    const balance = await this.contract.read.balanceOf([owner]);

    if (format) {
      return formatEther(balance);
    }
    return balance;
  }

  private setupContracts(chain: ForestChain, options?: TokenClientOptions) {
    this.contract = getContract({
      address:
        options?.contractAddress ||
        getContractAddressByChain(chain, ForestTokenAddress),
      abi: ForestTokenABI,
      client: this.publicClient!,
    });

    if (this.account) {
      this.walletClient = createWalletClient({
        transport: http(this.publicClient!.transport.url),
        account: this.account!,
        chain: this.publicClient!.chain,
      });
    }
  }

  private checkAccount() {
    if (!this.account) {
      throw new NotInitialized("Account for write");
    }

    if (!this.walletClient) {
      throw new NotInitialized("Wallet client for write");
    }
  }
}
