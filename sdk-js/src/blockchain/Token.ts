import { ForestChain, ForestPublicClientType } from "@/types";
import { Account, Address, formatEther } from "viem";
import { ForestTokenABI } from "./abi/forest-token";
import { ForestTokenAddress } from "@/constants";
import { throttleRequest } from "@/throttle";
import { ContractClient, ContractClientOptions } from "./ContractClient";

/**
 * @deprecated
 */
export type TokenClientOptions = {
  contractAddress?: Address;
};

export class Token extends ContractClient<typeof ForestTokenABI> {
  constructor(options: ContractClientOptions) {
    super(ForestTokenABI, {
      ...options,
      addresses: ForestTokenAddress,
    });
  }

  /**
   * Creates a Token instance for Forest Token contract.
   * @param chain
   * @param rpcHost
   * @param account
   * @deprecated Use constructor instead
   */
  static create(
    chain: ForestChain,
    rpcHost: string,
    account?: Account,
    options?: TokenClientOptions
  ) {
    return new Token({
      chain,
      rpcHost,
      account,
      address: options?.contractAddress,
    });
  }

  /**
   * @deprecated Use constructor instead
   */
  static createWithClient(
    client: ForestPublicClientType,
    account?: Account,
    options?: TokenClientOptions
  ) {
    return new Token({
      client,
      account,
      address: options?.contractAddress,
    });
  }

  /**
   * Makes the calculations and distribute the rewards between PT owners, Providers and Validators.
   * It can be called by anyone who registered in the protocol. The epoch has to be via `slasher.closeEpoch`
   * before calling this function.
   * @param epoch Epoch for calculating rewards. Rewards can be distributed only once per epoch.
   */
  async emitRewards(epoch: bigint) {
    this.checkAccount();
    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract!.abi,
        address: this.contract!.address,
        functionName: "emitRewards",
        account: this.account,
        args: [epoch],
      })
    );

    await this.writeContract(request);
  }

  /** notice Returns the end block number of the last epoch for which rewards were emitted
   * return The end block number of last emitted epoch
   */

  async getLastEmissionsEpochBlockNum() {
    return await throttleRequest(() =>
      this.contract.read.getLastEmissionsBlockNum()
    );
  }

  /**
   * Returns the end block number of the last epoch for which rewards were emitted
   * return The end block number of last emitted epoch
   */

  async getLastEmittedEpochBlockNum() {
    return await throttleRequest(() =>
      this.contract.read.getLastEmittedEpochBlockNum()
    );
  }

  /**
   * Sets allowance for a spender address.
   * @param spender
   * @param amount
   */
  async setAllowance(spender: Address, amount: bigint) {
    this.checkAccount();

    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract!.abi,
        address: this.contract!.address,
        functionName: "approve",
        account: this.account,
        args: [spender, amount],
      })
    );

    await this.writeContract(request);
  }

  /**
   * Get decimals of the token.
   */
  async getDecimals(): Promise<number> {
    return await throttleRequest(() => this.contract.read.decimals());
  }

  /**
   * Pauses the token contract. Only can be called by the Admin.
   */
  async pause() {
    this.checkAccount();
    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract!.abi,
        address: this.contract!.address,
        functionName: "pause",
        account: this.account,
        args: [],
      })
    );

    await this.writeContract(request);
  }

  /**
   * Unpauses the token contract. Only can be called by the Admin.
   */
  async unpause() {
    this.checkAccount();
    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract!.abi,
        address: this.contract!.address,
        functionName: "unpause",
        account: this.account,
        args: [],
      })
    );

    await this.writeContract(request);
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
    format = false
  ): Promise<string | bigint> {
    const amount = await throttleRequest(() =>
      this.contract.read.allowance([owner, spender])
    );

    if (format) {
      return formatEther(amount);
    }
    return amount;
  }

  /**
   * Reads current forest tokens emission.
   */
  async calculateCurrentTokensEmission() {
    return await throttleRequest(() =>
      this.contract.read.calculateCurrentEmissionAmount()
    );
  }

  /**
   * Reads the balance of an account.
   * @param owner
   * @param format If it is true, formats the balance as a human readable string.
   */
  async getBalance(owner: Address, format: true): Promise<string>;
  async getBalance(owner: Address, format?: false): Promise<bigint>;
  async getBalance(owner: Address, format = false) {
    const balance = await throttleRequest(() =>
      this.contract.read.balanceOf([owner])
    );

    if (format) {
      return formatEther(balance);
    }
    return balance;
  }
}
