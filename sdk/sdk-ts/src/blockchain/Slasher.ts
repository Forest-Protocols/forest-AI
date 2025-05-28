import { ForestChain, ForestPublicClientType, ProviderScore } from "@/types";

import { Account, Address, Hex } from "viem";
import { ActorNotFound } from "@/errors";
import { SlasherABI } from "./abi/slasher";
import { ActorType, ForestSlasherAddress } from "@/constants";
import { throttleRequest } from "@/throttle";
import { ContractClient, ContractClientOptions } from "./ContractClient";
import { Registry } from "./Registry";
import { generateCID } from "@/utils";

export type SlasherClientOptions = ContractClientOptions & {
  /**
   * @deprecated Use `address` instead
   */
  contractAddress?: Address;
  registryContractAddress?: Address;
};

export class Slasher extends ContractClient<typeof SlasherABI> {
  registry: Registry;

  constructor(options: SlasherClientOptions) {
    super(SlasherABI, {
      ...options,
      address: options.address || options.contractAddress,
      addresses: ForestSlasherAddress,
    });

    this.registry = new Registry({
      // Inherit all options expect Registry contract address
      ...options,
      address: options.registryContractAddress,
    });
  }

  /**
   * Instantiates a new Slasher to interact with a Forest Slasher smart contract.
   * @param chain
   * @param rpcHost Without protocol prefix (such as `http://` or `ws://`)
   * @param account The account will be used in blockchain write operations if it is provided.
   * @deprecated Use constructor instead
   */
  static create(
    chain: ForestChain,
    rpcHost: string,
    account?: Account,
    options?: { contractAddress?: Address; registryContractAddress?: Address }
  ) {
    return new Slasher({
      account,
      chain,
      rpcHost,
      address: options?.contractAddress,
      registryContractAddress: options?.registryContractAddress,
    });
  }

  /**
   * @deprecated Use constructor instead
   */
  static createWithClient(
    client: ForestPublicClientType,
    account?: Account,
    options?: { contractAddress?: Address; registryContractAddress?: Address }
  ) {
    return new Slasher({
      account,
      client,
      address: options?.contractAddress,
      registryContractAddress: options?.registryContractAddress,
    });
  }

  /**
   * Gets the end block number of the current epoch.
   */
  async getCurrentEpochEndBlock() {
    return await throttleRequest(() =>
      this.contract.read.getCurrentEpochEndBlockNum()
    );
  }

  /**
   * Returns true if the last Epoch is closed.
   * @returns
   */
  async isLastEpochClosed() {
    const [currentEpochEndBlock, lastEpochEndBlock] = await Promise.all([
      throttleRequest(() =>
        this.contract.read.computeCurrentEpochEndBlockNum()
      ),
      throttleRequest(() => this.contract.read.getCurrentEpochEndBlockNum()),
    ]);

    return lastEpochEndBlock == currentEpochEndBlock;
  }

  /**
   * Computes hash of Provider scores for commitment
   */
  async computeHash(scores: ProviderScore[]) {
    return await throttleRequest(() =>
      this.contract.read.computeHash([scores])
    );
  }

  /**
   * Gets the aggregated scores for all PTs for a specific epoch
   */

  async getEpochScoresAggregated(lastEpochEndBlockNum: bigint) {
    return await throttleRequest(() =>
      this.contract.read.getEpochScoresAggregate([lastEpochEndBlockNum])
    );
  }

  /**
   * Commits the hash of a result into the given protocol.
   */
  async commitResult(
    commitHash: Hex,
    validatorAddress: Address,
    pcAddress: Address,
    cid?: string,
  ) {
    this.checkAccount();
    cid??= (await generateCID(commitHash)).toString();
    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "commit",
        account: this.account,
        args: [commitHash, validatorAddress, pcAddress, cid],
      })
    );

    await this.writeContract(request);
  }

  /**
   * Gets Epoch length
   */
  async getEpochLength() {
    return await throttleRequest(() => this.contract.read.EPOCH_LENGTH());
  }

  /**
   * Gets Reveal Window length
   */
  async getRevealWindow() {
    return await throttleRequest(() => this.contract.read.REVEAL_WINDOW());
  }

  /**
   * Reveals a pre-committed score.
   * @param pcAddress Protocol address
   */
  async revealResult(
    commitHash: Hex,
    validatorAddress: Address,
    pcAddress: Address,
    providerScores: ProviderScore[]
  ) {
    this.checkAccount();
    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "reveal",
        account: this.account,
        args: [commitHash, validatorAddress, pcAddress, providerScores],
      })
    );

    await this.writeContract(request);
  }

  /**
   * Adds more tokens to the collateral of the caller.
   * The caller must be the owner of the actor (provider or validator)
   * who already registered in the protocol.
   * @param pcAddress Protocol address
   * @param amount Amount of FOREST token
   * @param actorType Actor type of the owner. If not given, automatically makes a request to the registry and retrieves actor type of the owner.
   */
  async topupActorCollateral(
    pcAddress: Address,
    amount: bigint,
    actorType?: ActorType
  ) {
    this.checkAccount();

    if (actorType === undefined) {
      const actor = await throttleRequest(() =>
        this.registry.getActor(this.account!.address)
      );

      if (!actor) {
        throw new ActorNotFound(this.account!.address);
      }

      actorType = actor.actorType;
    }

    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "topupActorCollateral",
        account: this.account,
        args: [pcAddress, actorType, this.account!.address, amount],
      })
    );

    await this.writeContract(request);
  }

  /**
   * Closes an epoch and sets scores for the actors. An epoch represents a time range for
   * reward distributions. By default it is 1 week.
   *
   * It can be called by anyone who registered in the protocol. Since the epoch is set to
   * 1 week, `closeEpoch` can be called once in a week. If it is called twice, the second
   * call will be reverted.
   */
  async closeEpoch() {
    this.checkAccount();
    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "closeEpoch",
        account: this.account,
        args: [],
      })
    );

    await this.writeContract(request);
  }

  /**
   * If the actor deposited collateral more than min collateral, withdraws some of it (as long as the left collateral is > min collateral of the protocol).
   * Caller must be the owner of the provider.
   * @param pcAddress Protocol address
   * @param amount
   * @param actorType Actor type of the owner. If not given, automatically makes a request to the registry to retrieve actor type of the owner.
   */
  async withdrawActorCollateral(
    pcAddress: Address,
    amount: bigint,
    actorType?: ActorType
  ) {
    this.checkAccount();

    if (actorType === undefined) {
      const actor = await throttleRequest(() =>
        this.registry.getActor(this.account!.address)
      );

      if (!actor) {
        throw new ActorNotFound(this.account!.address);
      }

      actorType = actor.actorType;
    }

    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "withdrawActorCollateral",
        account: this.account,
        args: [pcAddress, actorType, amount],
      })
    );

    await this.writeContract(request);
  }

  /**
   * Pauses the slasher contract. Only can be called by the Admin.
   */
  async pause() {
    this.checkAccount();
    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "pause",
        account: this.account,
        args: [],
      })
    );

    await this.writeContract(request);
  }

  /**
   * Unpauses the slasher contract. Only can be called by the Admin.
   */
  async unpause() {
    this.checkAccount();
    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "unpause",
        account: this.account,
        args: [],
      })
    );

    await this.writeContract(request);
  }
}
