import {
  Actor,
  Agreement,
  ForestChain,
  ForestPublicClientType,
  Offer,
  ProtocolInfo,
  Provider,
  RegistryContractType,
  Validator,
} from "@/types";
import { generateCID } from "@/utils";
import { Account, Address } from "viem";
import { ProtocolABI } from "./abi/protocol";
import { ActorType } from "@/constants";
import { throttleRequest } from "@/throttle";
import { ContractClient, ContractClientOptions } from "./ContractClient";
import { Registry } from "./Registry";

export type ProtocolClientOptions = ContractClientOptions & {
  address: Address;
  registryContractAddress?: Address;

  /**
   * @deprecated Use `registryContractAddress` instead
   */
  registryAddress?: Address;
};

export class Protocol extends ContractClient<typeof ProtocolABI> {
  registry: Registry;

  /**
   * @deprecated Use `registry` instead
   */
  registryContract?: RegistryContractType;

  /**
   * @deprecated Use `address` instead
   */
  contractAddress?: Address;

  /**
   * Instantiates a new Protocol client
   */
  constructor(options: ProtocolClientOptions) {
    super(ProtocolABI, options);

    this.registry = new Registry({
      // Inherit all options expect contract address
      ...options,
      address: options.registryContractAddress || options.registryAddress,
    });

    this.contractAddress = this.address;
  }

  /**
   * Instantiates a new Protocol to interact with a Protocol smart contract.
   * @param chain
   * @param rpcHost Without protocol prefix (such as `http://` or `ws://`)
   * @param contractAddress Contract address of the protocol
   * @param account The account will be used in blockchain write operations if it is provided.
   * @deprecated Use constructor instead
   */
  static create(
    chain: ForestChain,
    rpcHost: string,
    contractAddress: Address,
    account?: Account,
    options?: { registryAddress?: Address }
  ) {
    return new Protocol({
      account,
      chain,
      rpcHost,
      address: contractAddress,
      registryContractAddress: options?.registryAddress,
    });
  }

  /**
   * Instantiates a Protocol with the given RPC client instead of creating a new one.
   * @param client Pre-created RPC client.
   * @param contractAddress Protocol address.
   * @param account If given it will be used for the write operations.
   * @deprecated Use constructor instead
   */
  static createWithClient(
    client: ForestPublicClientType,
    contractAddress: Address,
    account?: Account,
    options?: { registryAddress?: Address }
  ) {
    return new Protocol({
      account,
      client,
      address: contractAddress,
      registryContractAddress: options?.registryAddress,
    });
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
    // If the identifier is an address, just use it because
    // we already have a function to retrieve provider info
    // by its owner address.
    if (typeof providerIdOrAddress === "string") {
      return await throttleRequest(() =>
        this.registry.getActor(providerIdOrAddress)
      );
    }

    // Otherwise we need make a search over all of the providers
    const allProviders = await throttleRequest(() =>
      this.registry.getAllProviders()
    );
    return allProviders.find((provider) => provider.id == providerIdOrAddress);
  }

  /**
   *Gets the Total Value Serviced for an Actor(value of all active Agreements for the Actor)
   */
  async getActorTvs(actorAddress: Address): Promise<bigint> {
    return await throttleRequest(() =>
      this.contract!.read.getActorTvs([actorAddress])
    );
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
      throttleRequest(() => this.contract.read.getOwnerAddr()),
      throttleRequest(() => this.contract.read.getAgreementsCount()),
      throttleRequest(() => this.contract.read.getAllProviderIds()),
      throttleRequest(() => this.contract.read.getAllValidatorIds()),
      throttleRequest(() => this.contract.read.getDetailsLink()),
      this.getEmissionShares(),
      this.getRegistrationFees(),
      this.getMaxActors(),
      throttleRequest(() => this.contract.read.getMinCollateral()),
      throttleRequest(() => this.contract.read.getOffersCount()),
      throttleRequest(() => this.contract.read.getTermUpdateDelay()),
    ]);

    return {
      contractAddress: this.address,
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
    const totalAgreementCount = await throttleRequest(() =>
      this.contract.read.getAgreementsCount()
    );

    if (totalAgreementCount == 0n) {
      return [];
    }

    const agreements = await Promise.all(
      Array.from({ length: Number(totalAgreementCount) }, (_, i) =>
        throttleRequest(() => this.contract.read.getAgreement([i]))
      )
    );

    return agreements;
  }

  /**
   * Gets the emission share percentages between actors.
   */
  async getEmissionShares() {
    const [provider, validator, pcOwner] = await throttleRequest(() =>
      this.contract.read.getEmissionShares()
    );

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
    const [validator, provider] = await throttleRequest(() =>
      this.contract.read.getMaxActors()
    );

    return {
      provider,
      validator,
    };
  }

  /**
   * Gets the registration fees.
   */
  async getRegistrationFees() {
    const [validator, provider, offer] = await throttleRequest(() =>
      this.contract.read.getFees()
    );

    return {
      provider,
      validator,
      offer,
    };
  }

  /**
   * Gets the details link of the protocol.
   */
  async getDetailsLink(): Promise<string> {
    return await throttleRequest(() => this.contract.read.getDetailsLink());
  }

  /**
   * Gets the total agreement count has been made (including the non-active ones)
   */
  async getAgreementsCount(): Promise<bigint> {
    return await throttleRequest(() => this.contract.read.getAgreementsCount());
  }

  /**
   * Gets minimum collateral to register.
   */
  async getMinCollateral(): Promise<bigint> {
    return await throttleRequest(() => this.contract.read.getMinCollateral());
  }

  /**
   * Gets the owner address of the protocol.
   */
  async getOwnerAddress(): Promise<Address> {
    return await throttleRequest(() => this.contract.read.getOwnerAddr());
  }

  /**
   * Gets the term update delay (in block count).
   */
  async getTermUpdateDelay(): Promise<bigint> {
    return await throttleRequest(() => this.contract.read.getTermUpdateDelay());
  }

  /**
   * Get the registered offer count.
   */
  async getOffersCount(): Promise<bigint> {
    return await throttleRequest(() => this.contract.read.getOffersCount());
  }

  /**
   * Gets all the registered offers.
   */
  async getAllOffers(): Promise<Offer[]> {
    const totalOfferCount = await throttleRequest(() =>
      this.contract.read.getOffersCount()
    );

    if (totalOfferCount == 0n) {
      return [];
    }

    const offers = await Promise.all(
      Array.from({ length: Number(totalOfferCount) }, (_, i) =>
        throttleRequest(() => this.contract.read.getOffer([i]))
      )
    );

    return offers;
  }

  /**
   * Gets information of an offer.
   */
  async getOffer(offerId: number): Promise<Offer> {
    return await throttleRequest(() => this.contract.read.getOffer([offerId]));
  }

  /**
   * Gets information of an agreement.
   */
  async getAgreement(agreementId: number): Promise<Agreement> {
    return await throttleRequest(() =>
      this.contract.read.getAgreement([agreementId])
    );
  }

  /**
   * Gets the remaining deposited balance of an agreement.
   * @deprecated Use `getRemainingAgreementBalance` instead
   */
  async getAgreementBalance(agreementId: number): Promise<bigint> {
    return await throttleRequest(() =>
      this.contract.read.getBalanceMinusOutstanding([agreementId])
    );
  }

  /**
   * Just an alias for `getTotalRevenue`
   */
  async getAgreementsValue(): Promise<bigint> {
    return await this.getTotalRevenue();
  }
  /**
   * Gets the total revenue of this Protocol made from the Agreements.
   */
  async getTotalRevenue(): Promise<bigint> {
    return await throttleRequest(() =>
      this.contract.read.getActiveAgreementsValue()
    );
  }

  /**
   * Gets the remaining deposited balance of an agreement
   * after Provider's earning is subtracted.
   */
  async getRemainingAgreementBalance(agreementId: number): Promise<bigint> {
    return await throttleRequest(() =>
      this.contract.read.getBalanceMinusOutstanding([agreementId])
    );
  }

  /**
   * Gets all of the registered provider IDs.
   */
  async getAllProviderIds(): Promise<number[]> {
    return [
      ...(await throttleRequest(() => this.contract.read.getAllProviderIds())),
    ];
  }

  /**
   * Gets all of the registered validator IDs.
   */
  async getAllValidatorIds(): Promise<number[]> {
    return [
      ...(await throttleRequest(() => this.contract.read.getAllValidatorIds())),
    ];
  }

  /**
   * Gets all of the registered providers.
   */
  async getAllProviders(): Promise<Provider[]> {
    const [ids, providers] = await Promise.all([
      throttleRequest(() => this.contract.read.getAllProviderIds()),
      throttleRequest(() => this.registry.getAllProviders()),
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
   * Gets all of the registered providers.
   */

  async getAllValidators(): Promise<Validator[]> {
    const [ids, validators] = await Promise.all([
      throttleRequest(() => this.contract.read.getAllValidatorIds()),
      throttleRequest(() => this.registry.getAllValidators()),
    ]);
    const ptValidators: Validator[] = [];

    for (const id of ids) {
      const validator = validators.find((prov) => prov.id == id);

      if (validator) {
        ptValidators.push(validator);
      }
    }

    return ptValidators;
  }

  /**
   * Gets all of the registered actors on the protocol.
   */
  async getAllActorsOnProtocol(): Promise<Actor[]> {
    const validators = await this.getAllValidators();
    const providers = await this.getAllProviders();
    const ownerAddr = await throttleRequest(() =>
      this.contract.read.getOwnerAddr()
    );
    const protocolOwner = (await throttleRequest(() =>
      this.registry.getActor(ownerAddr)
    )) as Actor;
    return [protocolOwner, ...validators, ...providers];
  }

  /**
   * Updates details link. Only can be called by the owner of the protocol.
   */
  async setDetailsLink(detailsLink: string) {
    this.checkAccount();

    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "setDetailsLink",
        account: this.account,
        args: [detailsLink],
      })
    );

    await this.writeContract(request);
  }

  /**
   * Updates emission sharing percentages. Only can be called by the owner of the protocol.
   */
  async setEmissionShares(shares: {
    provider: number;
    validator: number;
    pcOwner: number;
  }) {
    this.checkAccount();

    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "setEmissionShares",
        account: this.account,
        args: [
          BigInt(shares.provider),
          BigInt(shares.validator),
          BigInt(shares.pcOwner),
        ],
      })
    );

    await this.writeContract(request);
  }

  /**
   * Updates registration fees. Only can be called by the owner of the protocol.
   */
  async setRegistrationFees(fees: {
    provider: bigint;
    validator: bigint;
    offer: bigint;
  }) {
    this.checkAccount();
    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "setFees",
        account: this.account,
        args: [fees.validator, fees.provider, fees.offer],
      })
    );

    await this.writeContract(request);
  }

  /**
   * Updates max possible actor count. Only can be called by the owner of the protocol.
   */
  async setMaxActors(counts: { provider: number; validator: number }) {
    this.checkAccount();
    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "setMaxActors",
        account: this.account,
        args: [BigInt(counts.validator), BigInt(counts.provider)],
      })
    );

    await this.writeContract(request);
  }

  /**
   * Updates minimum collateral. Only can be called by the owner of the protocol.
   * @param collateral Amount of FOREST token.
   */
  async setMinCollateral(collateral: bigint) {
    this.checkAccount();
    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "setMinCollateral",
        account: this.account,
        args: [collateral],
      })
    );

    await this.writeContract(request);
  }

  /**
   * Updates the owner of the protocol. Only can be called by the owner of the protocol.
   * @param owner Address of the new owner.
   */
  async setOwner(owner: Address) {
    this.checkAccount();
    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "setOwner",
        account: this.account,
        args: [owner],
      })
    );

    await this.writeContract(request);
  }

  /**
   * Updates the min block for term update. Only can be called by the owner of the protocol.
   */
  async setTermUpdateDelay(blockCount: bigint) {
    this.checkAccount();
    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "setTermUpdateDelay",
        account: this.account,
        args: [blockCount],
      })
    );

    await this.writeContract(request);
  }

  /**
   * Closes an agreement. If the caller is the owner of the agreement, it will be closed normally.
   * If the caller is the provider of the agreement, then the agreement will be force closed
   * if it has ran out of balance. If it still has balance, TX will be reverted.
   * @param agreementId
   */
  async closeAgreement(agreementId: number) {
    this.checkAccount();
    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "closeAgreement",
        account: this.account,
        args: [agreementId],
      })
    );

    await this.writeContract(request);
  }

  /**
   * Registers a new actor inside the protocol.
   */
  async registerActor(actorType: ActorType, initialCollateral: bigint) {
    this.checkAccount();
    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "registerActor",
        account: this.account,
        args: [actorType, initialCollateral],
      })
    );

    await this.writeContract(request);
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
    this.checkAccount();
    if (typeof params.detailsLink !== "string") {
      params.detailsLink = (await generateCID(params.detailsLink)).toString();
    }

    const { result, request } = await throttleRequest(() =>
      this.client.simulateContract({
        address: this.contract.address,
        abi: this.contract.abi,
        functionName: "registerOffer",
        account: this.account!,
        args: [
          params.providerOwnerAddress,
          params.fee,
          params.stockAmount,
          params.detailsLink,
        ],
      })
    );

    await this.writeContract(request);

    return result;
  }

  /**
   * Withdraws earned fee from an agreement. Only can be called by a provider (or operator of the provider).
   */
  async withdrawReward(agreementId: number) {
    this.checkAccount();

    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "withdrawReward",
        account: this.account,
        args: [agreementId],
      })
    );

    await this.writeContract(request);
  }

  /**
   * Enters a new agreement with the given offer ID.
   * @param offerId
   * @param initialDeposit Minimum deposit must cover two months of fee
   */
  async enterAgreement(offerId: number, initialDeposit: bigint) {
    this.checkAccount();

    const { result, request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "enterAgreement",
        account: this.account!,
        args: [offerId, initialDeposit],
      })
    );

    await this.writeContract(request);

    return result;
  }

  /**
   * Add amount of deposit to the given agreement ID. Caller must be the owner of the agreement.
   * @param agreementId
   * @param amount Amount of USDC
   */
  async topupAgreement(agreementId: number, amount: bigint) {
    this.checkAccount();

    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "topUpExistingAgreement",
        account: this.account,
        args: [agreementId, amount],
      })
    );

    await this.writeContract(request);
  }

  /**
   * Gets outstanding reward of an agreement.
   */
  async getReward(agreementId: number): Promise<bigint> {
    return await throttleRequest(() =>
      this.contract.read.getOutstandingReward([agreementId])
    );
  }

  /**
   * If the user deposited too much to an agreement, withdraws it (that after the balance is not < 2 months fee)
   * @param amount Amount of USDC token
   */
  async withdrawUserBalance(agreementId: number, amount: bigint) {
    this.checkAccount();
    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "withdrawUserBalance",
        account: this.account,
        args: [agreementId, amount],
      })
    );

    await this.writeContract(request);
  }

  /**
   * Marks the offer as closed and makes it possible to force close
   * the agreements (that uses this offer) after the "term update delay"
   * has passed. Must be called either provider owner or the operator.
   */
  async requestOfferClose(offerId: number) {
    this.checkAccount();
    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "requestOfferClose",
        account: this.account,
        args: [offerId],
      })
    );

    await this.writeContract(request);
  }

  /**
   * Pauses an offer for the new agreements. Must be called either provider owner or the operator.
   */
  async pauseOffer(offerId: number) {
    this.checkAccount();
    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "pauseOffer",
        account: this.account,
        args: [offerId],
      })
    );

    await this.writeContract(request);
  }
  /**
   * Unpauses an offer and make it available again for the new agreements. Must be called either provider owner or the operator.
   */
  async unpauseOffer(offerId: number) {
    this.checkAccount();

    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "unpauseOffer",
        account: this.account,
        args: [offerId],
      })
    );

    await this.writeContract(request);
  }
}
