import {
  ForestChain,
  ForestPublicClientType,
  ForestWalletClientType,
  ProviderScore,
  RegistryContractType,
  SlasherContractType,
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
  getContract,
  Hex,
  http,
} from "viem";
import { ActorNotFound, NotInitialized } from "@/errors";
import { SlasherABI } from "./abi/slasher";
import {
  ActorType,
  ADDRESS_ZERO,
  ForestRegistryAddress,
  ForestSlasherAddress,
} from "@/constants";
import { RegistryABI } from "./abi/registry";
import { httpTransport } from "@/utils/viem";

export type SlasherClientOptions = {
  contractAddress?: Address;
  registryContractAddress?: Address;
};

export class Slasher {
  protected publicClient!: ForestPublicClientType;
  protected contract!: SlasherContractType;
  protected registryContract!: RegistryContractType;
  protected account?: Account;
  protected walletClient?: ForestWalletClientType;

  address!: Address;

  private constructor() {}

  /**
   * Instantiates a new Slasher to interact with a Forest Slasher smart contract.
   * @param chain
   * @param rpcHost Without protocol prefix (such as `http://` or `ws://`)
   * @param account The account will be used in blockchain write operations if it is provided.
   */
  static create(
    chain: ForestChain,
    rpcHost: string,
    account?: Account,
    options?: SlasherClientOptions
  ) {
    const slashes = new Slasher();

    slashes.publicClient = createPublicClient({
      chain: forestChainToViemChain(chain),
      transport: httpTransport(chain, rpcHost),
    });
    slashes.account = account;
    slashes.setupContracts(chain, options);

    return slashes;
  }

  static createWithClient(
    client: ForestPublicClientType,
    account?: Account,
    options?: SlasherClientOptions
  ) {
    const slashes = new Slasher();
    const forestChain = viemChainToForestChain(client.chain);

    slashes.publicClient = client;
    slashes.account = account;
    slashes.setupContracts(forestChain, options);

    return slashes;
  }

  /**
   * Gets the end block number of the current epoch.
   */
  async getCurrentEpochEndBlock() {
    return await this.contract.read.getCurrentEpochEndBlockNum();
  }

  /**
   * Commits the hash of a result into the given product category.
   */
  async commitResult(
    commitHash: Hex,
    validatorAddress: Address,
    pcAddress: Address
  ) {
    this.checkAccount();
    await this.contract.write.commit(
      [commitHash, validatorAddress, pcAddress],
      {
        chain: this.publicClient.chain,
        account: this.account!,
      }
    );
  }

  /**
   * Reveals a pre-committed score.
   * @param pcAddress Product category address
   */
  async revealResult(
    commitHash: Hex,
    validatorAddress: Address,
    pcAddress: Address,
    providerScores: ProviderScore[]
  ) {
    this.checkAccount();
    await this.contract.write.reveal(
      [commitHash, validatorAddress, pcAddress, providerScores],
      {
        chain: this.publicClient.chain,
        account: this.account!,
      }
    );
  }

  /**
   * Adds more tokens to the collateral of the caller.
   * The caller must be the owner of the actor (provider or validator)
   * who already registered in the protocol.
   * @param pcAddress Product category address
   * @param amount Amount of FOREST token
   * @param actorType Actor type of the owner. If not given, automatically makes a request to the registry to retrieve actor type of the owner.
   */
  async topupActorCollateral(
    pcAddress: Address,
    amount: bigint,
    actorType?: ActorType
  ) {
    this.checkAccount();

    if (actorType === undefined) {
      const actor = await this.registryContract.read.getActor([
        this.account!.address,
      ]);

      if (actor.ownerAddr == ADDRESS_ZERO) {
        throw new ActorNotFound(this.account!.address);
      }

      actorType = actor.actorType;
    }

    await this.contract!.write.topupActorCollateral(
      [pcAddress, actorType, this.account!.address, amount],
      {
        chain: this.publicClient.chain,
        account: this.account!,
      }
    );
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
    await this.contract.write.closeEpoch({
      account: this.account!,
      chain: this.publicClient!.chain,
    });
  }

  /**
   * If the actor deposited collateral more than min collateral, withdraws some of it (as long as the left collateral is > min collateral of the product category).
   * Caller must be the owner of the provider.
   * @param pcAddress Product category address
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
      const actor = await this.registryContract.read.getActor([
        this.account!.address,
      ]);

      if (actor.ownerAddr == ADDRESS_ZERO) {
        throw new ActorNotFound(this.account!.address);
      }

      actorType = actor.actorType;
    }

    await this.contract!.write.withdrawActorCollateral(
      [pcAddress, actorType, amount],
      {
        chain: this.publicClient.chain,
        account: this.account!,
      }
    );
  }

  /**
   * Pauses the slasher contract. Only can be called by the Admin.
   */
  async pause() {
    this.checkAccount();
    await this.contract.write.pause({
      account: this.account!,
      chain: this.publicClient.chain,
    });
  }

  /**
   * Unpauses the slasher contract. Only can be called by the Admin.
   */
  async unpause() {
    this.checkAccount();
    await this.contract.write.unpause({
      account: this.account!,
      chain: this.publicClient.chain,
    });
  }

  private setupContracts(chain: ForestChain, options?: SlasherClientOptions) {
    this.address =
      options?.contractAddress ||
      getContractAddressByChain(chain, ForestSlasherAddress);

    this.contract = getContract({
      address: this.address,
      abi: SlasherABI,
      client: this.publicClient!,
    });

    this.registryContract = getContract({
      address:
        options?.registryContractAddress ||
        getContractAddressByChain(chain, ForestRegistryAddress),
      abi: RegistryABI,
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

  /**
   * Checks if the account given to this instance for write operations.
   */
  private checkAccount() {
    if (!this.account) {
      throw new NotInitialized("Account for write");
    }

    if (!this.walletClient) {
      throw new NotInitialized("Wallet client for write");
    }
  }
}
