import {
  Agreement,
  ForestChain,
  ForestPublicClientType,
  ForestWalletClientType,
  Offer,
  ProtocolContractType,
  ProtocolInfo,
  Provider,
  RegistryContractType,
} from "@/types";
import {
  forestChainToViemChain,
  generateCID,
  getContractAddressByChain,
  viemChainToForestChain,
} from "@/utils";
import {
  Account,
  Address,
  createPublicClient,
  createWalletClient,
  getContract,
  http,
} from "viem";
import { ProtocolABI } from "./abi/product-category";
import { NotInitialized } from "@/errors";
import { RegistryABI } from "./abi/registry";
import { ActorType, ForestRegistryAddress } from "@/constants";
import { httpTransport } from "@/utils/viem";

export type ProtocolClientOptions = {
  registryAddress?: Address;
};

export class Protocol {
  protected publicClient?: ForestPublicClientType;
  protected contract?: ProtocolContractType;
  protected walletClient?: ForestWalletClientType;
  protected registryContract?: RegistryContractType;
  protected account?: Account;

  contractAddress?: Address;

  /**
   * Just an alias for `contractAddress`.
   */
  address?: Address;

  // TODO: Make the constructor private.
  /**
   * Use `create` or `createWithClient` static methods to create an instance.
   */
  constructor() {}

  /**
   * Instantiates a new Protocol to interact with a Protocol smart contract.
   * @param chain
   * @param rpcHost Without protocol prefix (such as `http://` or `ws://`)
   * @param contractAddress Contract address of the product category
   * @param account The account will be used in blockchain write operations if it is provided.
   */
  static create(
    chain: ForestChain,
    rpcHost: string,
    contractAddress: Address,
    account?: Account,
    options?: ProtocolClientOptions
  ) {
    const pc = new Protocol();

    pc.publicClient = createPublicClient({
      chain: forestChainToViemChain(chain),
      transport: httpTransport(chain, rpcHost),
    });
    pc.setupContracts(chain, contractAddress, options);
    pc.account = account;

    return pc;
  }

  /**
   * Instantiates a Protocol with the given RPC client instead of creating a new one.
   * @param client Pre-created RPC client.
   * @param contractAddress Product category address.
   * @param account If given it will be used for the write operations.
   */
  static createWithClient(
    client: ForestPublicClientType,
    contractAddress: Address,
    account?: Account,
    options?: ProtocolClientOptions
  ) {
    const pc = new Protocol();

    pc.publicClient = client;
    pc.setupContracts(
      viemChainToForestChain(client.chain),
      contractAddress,
      options
    );
    pc.account = account;

    return pc;
  }

  /**
   * Gets the Viem public client
   */
  get client() {
    return this.publicClient;
  }

  /**
   * Gets all existing agreements made with a specific provider.
   * @param providerIdOrAddress It can be either address or id of the provider. Using address is faster than ID.
   */
  async getAllProviderAgreements(
    providerIdOrAddress: number | Address
  ): Promise<Agreement[]> {
    const allAgreements = await this.getAllAgreements();
    const offers = await this.getAllOffers();
    const agreements: Agreement[] = [];

    // Since offer includes the provider's owner address,
    // it is more performant to use it.
    if (typeof providerIdOrAddress === "string") {
      for (const agreement of allAgreements) {
        const agreementOffer = offers.find(
          (offer) => offer.id == agreement.offerId
        );

        if (!agreementOffer) continue;

        // If offer of this agreement is belong to the given provider,
        if (agreementOffer.ownerAddr == providerIdOrAddress) {
          agreements.push(agreement);
        }
      }

      return agreements;
    } else {
      const provider = await this.getProvider(providerIdOrAddress);
      if (!provider) {
        return [];
      }

      // Same thing that we did above, but shorter.
      return allAgreements.filter(
        (agreement) =>
          offers.find((offer) => offer.ownerAddr == provider.ownerAddr)?.id ==
          agreement.id
      );
    }
  }

  /**
   * Gets all of the agreements that a particular user has entered
   */
  async getAllUserAgreements(userAddress: Address) {
    const allAgreements = await this.getAllAgreements();
    return allAgreements.filter(
      (agreement) => agreement.userAddr == userAddress
    );
  }

  /**
   * Gets all the offers registered by a provider.
   * @param providerIdOrAddress It can be either address or id of the provider. Using address is faster than ID.
   */
  async getAllProviderOffers(
    providerIdOrAddress: number | Address
  ): Promise<Offer[]> {
    const allOffers = await this.getAllOffers();

    // Since offer includes the provider's owner address,
    // it is more performant to use it.
    if (typeof providerIdOrAddress === "string") {
      return allOffers.filter(
        (_offer) => _offer.ownerAddr == providerIdOrAddress
      );
    } else {
      const provider = await this.getProvider(providerIdOrAddress);
      if (!provider) {
        return [];
      }

      // Only pick the offers registered by this provider.
      return allOffers.filter((offer) => offer.ownerAddr == provider.ownerAddr);
    }
  }

  /**
   * Gets information of a provider by its ID or address.
   */
  async getProvider(providerIdOrAddress: number | Address) {
    this.checkInit();

    // If the identifier is an address, just use it because
    // we already have a function to retrieve provider info
    // by its owner address.
    if (typeof providerIdOrAddress === "string") {
      return await this.registryContract!.read.getActor([providerIdOrAddress]);
    }

    // Otherwise we need make a search over all of the providers
    const allProviders = await this.registryContract!.read.getAllProviders();
    return allProviders.find((provider) => provider.id == providerIdOrAddress);
  }

  /**
   * Gets information of a provider by its ID
   * @deprecated Use `getProvider` instead
   */
  async getProviderById(id: number): Promise<Provider | undefined> {
    const allProviders = await this.getAllProviders();
    return allProviders.find((provider) => provider.id == id);
  }

  /**
   * Gets information of a provider by its address
   * @deprecated Use `getProvider` instead
   */
  async getProviderByAddress(
    providerOwnerAddress: Address
  ): Promise<Provider | undefined> {
    const allProviders = await this.getAllProviders();
    return allProviders.find(
      (provider) => provider.ownerAddr == providerOwnerAddress
    );
  }

  /**
   * Gets the information stored on-chain.
   */
  async getInfo(): Promise<ProtocolInfo> {
    this.checkInit();
    const [
      ownerAddress,
      agreementCount,
      providerIds,
      validatorIds,
      detailsLink,
      emissionShares,
      registrationFees,
      maxActorCount,
      minCollateral,
      offersCount,
      termUpdateDelay,
    ] = await Promise.all([
      this.contract!.read.getOwnerAddr(),
      this.contract!.read.getAgreementsCount(),
      this.contract!.read.getAllProviderIds(),
      this.contract!.read.getAllValidatorIds(),
      this.contract!.read.getDetailsLink(),
      this.getEmissionShares(),
      this.getRegistrationFees(),
      this.getMaxActors(),
      this.contract!.read.getMinCollateral(),
      this.contract!.read.getOffersCount(),
      this.contract!.read.getTermUpdateDelay(),
    ]);

    return {
      contractAddress: this.contractAddress!,
      ownerAddress,
      agreementCount,
      providerIds: [...providerIds],
      validatorIds: [...validatorIds],
      detailsLink,
      emissionShares,
      registrationFees,
      maxActorCount,
      minCollateral,
      offersCount,
      termUpdateDelay,
    };
  }

  /**
   * Gets all of the agreements.
   */
  async getAllAgreements(): Promise<Agreement[]> {
    this.checkInit();
    const totalAgreementCount = await this.contract!.read.getAgreementsCount();

    if (totalAgreementCount == 0n) {
      return [];
    }

    const agreements = await Promise.all(
      Array.from({ length: Number(totalAgreementCount) }, (_, i) =>
        this.contract!.read.getAgreement([i])
      )
    );

    return agreements;
  }

  /**
   * Gets the emission share percentages between actors.
   */
  async getEmissionShares() {
    this.checkInit();
    const [provider, validator, pcOwner] =
      await this.contract!.read.getEmissionShares();

    // Since these values are percentages, no need to use bigint
    return {
      provider: Number(provider),
      validator: Number(validator),
      pcOwner: Number(pcOwner),
    };
  }

  /**
   * Gets the max actor count can be registered.
   */
  async getMaxActors() {
    this.checkInit();
    const [validator, provider] = await this.contract!.read.getMaxActors();

    return {
      provider,
      validator,
    };
  }

  /**
   * Gets the registration fees.
   */
  async getRegistrationFees() {
    this.checkInit();
    const [validator, provider, offer] = await this.contract!.read.getFees();

    return {
      provider,
      validator,
      offer,
    };
  }

  /**
   * Gets the details link of the product category.
   */
  async getDetailsLink(): Promise<string> {
    this.checkInit();
    return await this.contract!.read.getDetailsLink();
  }

  /**
   * Gets the total agreement count has been made (including the non-active ones)
   */
  async getAgreementsCount(): Promise<bigint> {
    this.checkInit();
    return await this.contract!.read.getAgreementsCount();
  }

  /**
   * Gets minimum collateral to register.
   */
  async getMinCollateral(): Promise<bigint> {
    this.checkInit();
    return await this.contract!.read.getMinCollateral();
  }

  /**
   * Gets the owner address of the product category.
   */
  async getOwnerAddress(): Promise<Address> {
    this.checkInit();
    return await this.contract!.read.getOwnerAddr();
  }

  /**
   * Gets the term update delay (in block count).
   */
  async getTermUpdateDelay(): Promise<bigint> {
    this.checkInit();
    return await this.contract!.read.getTermUpdateDelay();
  }

  /**
   * Get the registered offer count.
   */
  async getOffersCount(): Promise<bigint> {
    this.checkInit();
    return await this.contract!.read.getOffersCount();
  }

  /**
   * Gets all the registered offers.
   */
  async getAllOffers(): Promise<Offer[]> {
    this.checkInit();
    const totalOfferCount = await this.contract!.read.getOffersCount();

    if (totalOfferCount == 0n) {
      return [];
    }

    const offers = await Promise.all(
      Array.from({ length: Number(totalOfferCount) }, (_, i) =>
        this.contract!.read.getOffer([i])
      )
    );

    return offers;
  }

  /**
   * Gets information of an offer.
   */
  async getOffer(offerId: number): Promise<Offer> {
    this.checkInit();

    return await this.contract!.read.getOffer([offerId]);
  }

  /**
   * Gets information of an agreement.
   */
  async getAgreement(agreementId: number): Promise<Agreement> {
    this.checkInit();
    return await this.contract!.read.getAgreement([agreementId]);
  }

  /**
   * Gets the remaining deposited balance of an agreement.
   * @param agreementId
   * @returns
   */
  async getAgreementBalance(agreementId: number): Promise<bigint> {
    this.checkInit();
    return await this.contract!.read.getBalanceMinusOutstanding([agreementId]);
  }

  /**
   * Gets all of the registered provider IDs.
   */
  async getAllProviderIds(): Promise<number[]> {
    this.checkInit();
    return [...(await this.contract!.read.getAllProviderIds())];
  }

  /**
   * Gets all of the registered validator IDs.
   */
  async getAllValidatorIds(): Promise<number[]> {
    this.checkInit();
    return [...(await this.contract!.read.getAllValidatorIds())];
  }

  /**
   * Gets all of the registered providers.
   */
  async getAllProviders(): Promise<Provider[]> {
    this.checkInit();
    const [ids, providers] = await Promise.all([
      this.contract!.read.getAllProviderIds(),
      this.registryContract!.read.getAllProviders(),
    ]);
    const pcProviders: Provider[] = [];

    for (const id of ids) {
      const provider = providers.find((prov) => prov.id == id);

      if (provider) {
        pcProviders.push(provider);
      }
    }

    return pcProviders;
  }

  /**
   * Updates details link. Only can be called by the owner of the product category.
   */
  async setDetailsLink(detailsLink: string) {
    this.checkInitWithAccount();
    await this.contract!.write.setDetailsLink([detailsLink], {
      chain: this.publicClient!.chain,
      account: this.account!,
    });
  }

  /**
   * Updates emission sharing percentages. Only can be called by the owner of the product category.
   */
  async setEmissionShares(shares: {
    provider: number;
    validator: number;
    pcOwner: number;
  }) {
    this.checkInitWithAccount();
    await this.contract!.write.setEmissionShares(
      [
        BigInt(shares.provider),
        BigInt(shares.validator),
        BigInt(shares.pcOwner),
      ],
      {
        chain: this.publicClient!.chain,
        account: this.account!,
      }
    );
  }

  /**
   * Updates registration fees. Only can be called by the owner of the product category.
   */
  async setRegistrationFees(fees: {
    provider: bigint;
    validator: bigint;
    offer: bigint;
  }) {
    this.checkInitWithAccount();
    await this.contract!.write.setFees(
      [fees.validator, fees.provider, fees.offer],
      {
        chain: this.publicClient!.chain,
        account: this.account!,
      }
    );
  }

  /**
   * Updates max possible actor count. Only can be called by the owner of the product category.
   */
  async setMaxActors(counts: { provider: number; validator: number }) {
    this.checkInitWithAccount();
    await this.contract!.write.setMaxActors(
      [BigInt(counts.validator), BigInt(counts.provider)],
      {
        chain: this.publicClient!.chain,
        account: this.account!,
      }
    );
  }

  /**
   * Updates minimum collateral. Only can be called by the owner of the product category.
   * @param collateral Amount of FOREST token.
   */
  async setMinCollateral(collateral: bigint) {
    this.checkInitWithAccount();
    await this.contract!.write.setMinCollateral([collateral], {
      chain: this.publicClient!.chain,
      account: this.account!,
    });
  }

  /**
   * Updates the owner of the product category. Only can be called by the owner of the product category.
   * @param owner Address of the new owner.
   */
  async setOwner(owner: Address) {
    this.checkInitWithAccount();
    await this.contract!.write.setOwner([owner], {
      chain: this.publicClient!.chain,
      account: this.account!,
    });
  }

  /**
   * Updates the min block for term update. Only can be called by the owner of the product category.
   */
  async setTermUpdateDelay(blockCount: bigint) {
    this.checkInitWithAccount();
    await this.contract!.write.setTermUpdateDelay([blockCount], {
      chain: this.publicClient!.chain,
      account: this.account!,
    });
  }

  /**
   * Closes an agreement. If the caller is the owner of the agreement, it will be closed normally.
   * If the caller is the provider of the agreement, then the agreement will be force closed
   * if it has ran out of balance. If it still has balance, TX will be reverted.
   * @param agreementId
   */
  async closeAgreement(agreementId: number) {
    this.checkInitWithAccount();

    await this.contract!.write.closeAgreement([agreementId], {
      account: this.account!,
      chain: this.publicClient?.chain,
    });
  }

  /**
   * Registers a new actor inside the product category.
   */
  async registerActor(actorType: ActorType, initialCollateral: bigint) {
    this.checkInitWithAccount();
    await this.contract!.write.registerActor([actorType, initialCollateral], {
      chain: this.publicClient!.chain,
      account: this.account!,
    });
  }

  /**
   * Registers a new offer.
   * @returns Registered offer id.
   */
  async registerOffer(params: {
    providerOwnerAddress: Address;
    fee: bigint;
    stockAmount: number;

    /**
     * If an object passed, then it uses the CID of the object by calling `generateCID`.
     */
    detailsLink: string | any;
  }) {
    this.checkInitWithAccount();
    if (typeof params.detailsLink !== "string") {
      params.detailsLink = (await generateCID(params.detailsLink)).toString();
    }

    const { result, request } = await this.publicClient!.simulateContract({
      address: this.contract!.address,
      abi: this.contract!.abi,
      functionName: "registerOffer",
      account: this.account!,
      args: [
        params.providerOwnerAddress,
        params.fee,
        params.stockAmount,
        params.detailsLink,
      ],
    });

    await this.walletClient!.writeContract(request);

    return result;
  }

  /**
   * Withdraws earned fee from an agreement. Only can be called by a provider (or operator of the provider).
   */
  async withdrawReward(agreementId: number) {
    this.checkInitWithAccount();
    await this.contract!.write.withdrawReward([agreementId], {
      chain: this.publicClient!.chain,
      account: this.account!,
    });
  }

  /**
   * Enters a new agreement with the given offer ID.
   * @param offerId
   * @param initialDeposit Minimum deposit must cover two months of fee
   */
  async enterAgreement(offerId: number, initialDeposit: bigint) {
    this.checkInitWithAccount();

    const { result, request } = await this.publicClient!.simulateContract({
      abi: this.contract!.abi,
      address: this.contract!.address,
      functionName: "enterAgreement",
      account: this.account!,
      args: [offerId, initialDeposit],
    });

    await this.walletClient!.writeContract(request);

    return result;
  }

  /**
   * Add amount of deposit to the given agreement ID. Caller must be the owner of the agreement.
   * @param agreementId
   * @param amount Amount of USDC
   */
  async topupAgreement(agreementId: number, amount: bigint) {
    this.checkInitWithAccount();
    await this.contract!.write.topUpExistingAgreement([agreementId, amount], {
      chain: this.publicClient!.chain,
      account: this.account!,
    });
  }

  /**
   * Gets outstanding reward of an agreement.
   */
  async getReward(agreementId: number): Promise<bigint> {
    this.checkInit();
    return await this.contract!.read.getOutstandingReward([agreementId]);
  }

  /**
   * If the user deposited too much to an agreement, withdraws it (that after the balance is not < 2 months fee)
   * @param amount Amount of USDC token
   */
  async withdrawUserBalance(agreementId: number, amount: bigint) {
    this.checkInitWithAccount();
    await this.contract!.write.withdrawUserBalance([agreementId, amount], {
      chain: this.publicClient!.chain,
      account: this.account!,
    });
  }

  /**
   * Marks the offer as closed and makes it possible to force close
   * the agreements (that uses this offer) after the "term update delay"
   * has passed. Must be called either provider owner or the operator.
   */
  async requestOfferClose(offerId: number) {
    this.checkInitWithAccount();
    await this.contract!.write.requestOfferClose([offerId], {
      chain: this.publicClient!.chain,
      account: this.account!,
    });
  }

  /**
   * Pauses an offer for the new agreements. Must be called either provider owner or the operator.
   */
  async pauseOffer(offerId: number) {
    this.checkInitWithAccount();
    await this.contract!.write.pauseOffer([offerId], {
      chain: this.publicClient!.chain,
      account: this.account!,
    });
  }
  /**
   * Unpauses an offer and make it available again for the new agreements. Must be called either provider owner or the operator.
   */
  async unpauseOffer(offerId: number) {
    this.checkInitWithAccount();
    await this.contract!.write.unpauseOffer([offerId], {
      chain: this.publicClient!.chain,
      account: this.account!,
    });
  }

  /**
   * Setup contract instances based on the given arguments.
   */
  private setupContracts(
    chain: ForestChain,
    pcContractAddress: Address,
    options?: ProtocolClientOptions
  ) {
    this.contractAddress = pcContractAddress;
    this.address = this.contractAddress;

    this.contract = getContract({
      address: this.address,
      client: this.publicClient!,
      abi: ProtocolABI,
    });
    this.registryContract = getContract({
      address:
        options?.registryAddress ||
        getContractAddressByChain(chain, ForestRegistryAddress),
      abi: RegistryABI,
      client: this.publicClient!,
    });

    this.walletClient = createWalletClient({
      transport: http(this.publicClient!.transport.url),
      account: this.account!,
      chain: this.publicClient!.chain,
    });
  }

  /**
   * Check if the variables are initialized for read operations.
   */
  private checkInit() {
    if (!this.publicClient) {
      throw new NotInitialized("Public (read) client");
    }
    if (!this.contract) {
      throw new NotInitialized("Protocol contract instance");
    }
  }

  /**
   * Check if the variables are initialized for read & write operations.
   */
  private checkInitWithAccount() {
    this.checkInit();
    if (!this.account) {
      throw new NotInitialized("Account for write");
    }
  }
}
