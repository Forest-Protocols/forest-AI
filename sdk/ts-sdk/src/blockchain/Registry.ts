import {
  Actor,
  ForestChain,
  ForestPublicClientType,
  ForestTokenContractType,
  ForestWalletClientType,
  ProtocolInfo,
  ProtocolInfo,
  Provider,
  RegistryContractType,
  Validator,
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
import { RegistryABI } from "./abi/registry";
import { NotInitialized } from "@/errors";
import { Protocol } from "./Protocol";
import {
  ActorType,
  ADDRESS_ZERO,
  BlockchainErrorSignatures,
  ForestRegistryAddress,
} from "@/constants";
import { InsufficientAllowance } from "@/errors/InsufficientAllowance";
import { InsufficientBalance } from "@/errors/InsufficientBalance";
import { httpTransport } from "@/utils/viem";

export type RegistryClientOptions = {
  contractAddress?: Address;
};

export class Registry {
  protected publicClient?: ForestPublicClientType;
  protected contract?: RegistryContractType;
  protected tokenContract?: ForestTokenContractType;
  protected account?: Account;
  protected walletClient?: ForestWalletClientType;

  registryAddress?: ForestRegistryAddress | Address;

  /**
   * Use "createWithClient" or "create" static methods to create an instance.
   */
  constructor() {}

  static create(
    chain: ForestChain,
    rpcHost: string,
    account?: Account,
    options?: RegistryClientOptions
  ) {
    const fr = new Registry();

    fr.publicClient = createPublicClient({
      chain: forestChainToViemChain(chain),
      transport: httpTransport(chain, rpcHost),
    });
    fr.account = account;
    fr.setupContracts(chain, options);

    return fr;
  }

  static createWithClient(
    client: ForestPublicClientType,
    account?: Account,
    options?: RegistryClientOptions
  ) {
    const fr = new Registry();
    const forestChain = viemChainToForestChain(client.chain);

    fr.publicClient = client;
    fr.account = account;
    fr.setupContracts(forestChain, options);

    return fr;
  }

  /**
   * Gets the Viem public client
   */
  get client() {
    return this.publicClient;
  }

  async getActor(address: Address): Promise<Actor | undefined> {
    this.checkClient();
    const actor = await this.contract!.read.getActor([address]);

    // If the owner address is zero, that means the actor not found
    if (actor.ownerAddr == ADDRESS_ZERO) {
      return;
    }

    return actor;
  }

  async getRegisteredPCsOfProvider(providerId: number) {
    const pcAddresses = await this.contract!.read.getAllPcAddresses();
    const pcs: string[] = [];

    for (const pcAddress of pcAddresses) {
      const pc = Protocol.createWithClient(
        this.publicClient!,
        pcAddress
      );
      const ids = await pc.getAllProviderIds();

      if (ids.find((id) => id == providerId)) {
        pcs.push(pcAddress);
      }
    }

    return pcs;
  }

  async getAllProviders(): Promise<Provider[]> {
    this.checkClient();
    return [...(await this.contract!.read.getAllProviders())];
  }

  async getAllValidators(): Promise<Validator[]> {
    return [...(await this.contract!.read.getAllValidators())];
  }

  async getActorCount(): Promise<bigint> {
    this.checkClient();
    return await this.contract!.read.getActorCount();
  }

  /**
   * Gets the product category information with its smart contract address.
   * @param address
   */
  async getProtocolInfo(
    address: Address
  ): Promise<ProtocolInfo | undefined> {
    this.checkClient();
    const pcs = await this.contract!.read.getAllPcAddresses();
    const pc = pcs.find((pcAddr) => pcAddr == address);

    if (!pc) {
      return;
    }

    const client = Protocol.createWithClient(
      this.publicClient!,
      pc,
      this.account
    );

    const info = await client.getInfo();

    return info;
  }

  async getAllProductCategories() {
    const pcs = await this.getAllProtocolAddresses();
    return pcs.map((pc) =>
      Protocol.createWithClient(this.publicClient!, pc, this.account)
    );
  }

  async getAllProtocolAddresses(): Promise<Address[]> {
    this.checkClient();
    return [...(await this.contract!.read.getAllPcAddresses())];
  }

  async getBurnRatio(): Promise<bigint> {
    this.checkClient();
    return await this.contract!.read.getBurnRatio();
  }

  async getMaximumProtocolCount(): Promise<bigint> {
    this.checkClient();
    return await this.contract!.read.getMaxPcsNum();
  }

  async getOfferRegistrationFeeInPC(): Promise<bigint> {
    this.checkClient();
    return await this.contract!.read.getOfferInPcRegFee();
  }

  async getTotalPCCount(): Promise<bigint> {
    this.checkClient();
    return await this.contract!.read.getPcsCount();
  }

  async getProvidersCount(): Promise<bigint> {
    this.checkClient();
    return await this.contract!.read.getProvidersCount();
  }

  async getValidatorsCount(): Promise<bigint> {
    this.checkClient();
    return await this.contract!.read.getValidatorsCount();
  }

  async getRevenueShare(): Promise<bigint> {
    this.checkClient();
    return await this.contract!.read.getRevenueShare();
  }

  async getForestTokenAddress(): Promise<Address> {
    this.checkClient();
    return await this.contract!.read.getForestTokenAddr();
  }

  async getSlasherContractAddress(): Promise<Address> {
    this.checkClient();
    return await this.contract!.read.getSlasherAddr();
  }

  async getTreasureAddress(): Promise<Address> {
    this.checkClient();
    return await this.contract!.read.getTreasuryAddr();
  }

  async isActorActive(addr: Address): Promise<boolean> {
    this.checkClient();
    return await this.contract!.read.isActiveActor([addr]);
  }

  /**
   * Gets product category registration fee.
   */
  async getPCRegistrationFee(): Promise<bigint> {
    this.checkClient();
    return await this.contract!.read.getPcRegFee();
  }

  async getActorRegistrationFeeInPC(): Promise<bigint> {
    this.checkClient();
    return await this.contract!.read.getActorInPcRegFee();
  }

  async getActorRegistrationFee() {
    this.checkClient();
    return await this.contract!.read.getActorRegFee();
  }

  async setActorInPCRegistrationFee(fee: bigint) {
    this.checkClient();
    this.checkAccount();
    await this.contract!.write.setActorInPcRegFee([fee], {
      chain: this.publicClient!.chain,
      account: this.account!,
    });
  }

  async setActorInProtocolRegistrationFee(fee: bigint) {
    this.checkClient();
    this.checkAccount();
    await this.contract!.write.setActorRegFee([fee], {
      chain: this.publicClient!.chain,
      account: this.account!,
    });
  }

  async setBurnRatio(fee: bigint) {
    this.checkClient();
    this.checkAccount();
    await this.contract!.write.setBurnRatio([fee], {
      chain: this.publicClient!.chain,
      account: this.account!,
    });
  }

  async setMaxPCCount(count: number | bigint) {
    this.checkClient();
    this.checkAccount();
    await this.contract!.write.setMaxPcsNum([BigInt(count)], {
      chain: this.publicClient!.chain,
      account: this.account!,
    });
  }

  async setOfferInPCRegistrationFee(fee: bigint) {
    this.checkClient();
    this.checkAccount();
    await this.contract!.write.setOfferInPcRegFee([fee], {
      chain: this.publicClient!.chain,
      account: this.account!,
    });
  }

  async setPCRegistrationFee(fee: bigint) {
    this.checkClient();
    this.checkAccount();
    await this.contract!.write.setPcRegFee([fee], {
      chain: this.publicClient!.chain,
      account: this.account!,
    });
  }

  async setRevenueShare(share: bigint) {
    this.checkClient();
    this.checkAccount();
    await this.contract!.write.setRevenueShare([share], {
      chain: this.publicClient!.chain,
      account: this.account!,
    });
  }

  async setTreasuryAddress(address: Address) {
    this.checkClient();
    this.checkAccount();
    await this.contract!.write.setTreasuryAddrParam([address], {
      chain: this.publicClient!.chain,
      account: this.account!,
    });
  }

  /**
   * Updates details of an actor who already registered in the protocol.
   * @param detailsLink If given as an object, calculates and uses its CID. Otherwise (it is a string) uses it as it is.
   */
  async updateActorDetails(
    type: ActorType,
    detailsLink: string | any,
    operatorAddress?: Address,
    billingAddress?: Address
  ) {
    this.checkClient();
    this.checkAccount();

    if (typeof detailsLink !== "string") {
      detailsLink = await generateCID(detailsLink);
    }

    await this.contract!.write.updateActorDetails(
      [
        type,
        operatorAddress || ADDRESS_ZERO,
        billingAddress || ADDRESS_ZERO,
        detailsLink,
      ],
      {
        chain: this.publicClient!.chain,
        account: this.account!,
      }
    );
  }

  /**
   * Pauses work of the protocol. Only can be called by the Admin.
   */
  async pauseProtocol() {
    this.checkClient();
    this.checkAccount();
    await this.contract!.write.pause({
      chain: this.publicClient!.chain,
      account: this.account!,
    });
  }

  /**
   * Unpauses work of the protocol. Only can be called by the Admin.
   */
  async unpauseProtocol() {
    this.checkClient();
    this.checkAccount();
    await this.contract!.write.unpause({
      chain: this.publicClient!.chain,
      account: this.account!,
    });
  }

  /**
   * Gets protocol params/settings.
   */
  async getProtocolInfo(): Promise<ProtocolInfo> {
    this.checkClient();
    const [
      totalActorCount,
      totalProvidersCount,
      totalValidatorsCount,
      totalPCCount,
      maxPCCount,
      actorPCRegistrationFee,
      actorRegistrationFee,
      burnRatio,
      offerPCRegistrationFee,
      pcRegistrationFee,
      revenueShare,
    ] = await Promise.all([
      this.contract!.read.getActorCount(),
      this.contract!.read.getProvidersCount(),
      this.contract!.read.getValidatorsCount(),
      this.contract!.read.getPcsCount(),
      this.contract!.read.getMaxPcsNum(),
      this.contract!.read.getActorInPcRegFee(),
      this.contract!.read.getActorRegFee(),
      this.contract!.read.getBurnRatio(),
      this.contract!.read.getOfferInPcRegFee(),
      this.contract!.read.getPcRegFee(),
      this.contract!.read.getRevenueShare(),
    ]);

    return {
      totalActorCount,
      totalProvidersCount,
      totalValidatorsCount,
      totalPCCount,
      maxPCCount,
      actorPCRegistrationFee,
      actorRegistrationFee,
      burnRatio,
      offerPCRegistrationFee,
      pcRegistrationFee,
      revenueShare,
    };
  }

  /**
   * Creates a new product category inside the protocol.
   * @param params Parameters of the creation process
   * @returns Smart contract address of the newly created product category.
   */
  async createProtocol(params: {
    maxValidator: bigint | number;
    maxProvider: bigint | number;
    minCollateral: bigint | number;
    validatorRegistrationFee: bigint | number;
    providerRegistrationFee: bigint | number;
    offerRegistrationFee: bigint | number;
    termUpdateDelay: bigint | number;
    providerShare: bigint | number;
    validatorShare: bigint | number;
    pcOwnerShare: bigint | number;
    detailsLink: string;
  }) {
    this.checkClient();
    this.checkAccount();

    const convertToBigInt = (num: bigint | number) =>
      typeof num === "number" ? BigInt(num) : num;
    const { result, request } = await this.publicClient!.simulateContract({
      address: this.contract!.address,
      abi: this.contract!.abi,
      functionName: "createProtocol",
      account: this.account!,
      args: [
        convertToBigInt(params.maxValidator),
        convertToBigInt(params.maxProvider),
        convertToBigInt(params.minCollateral),
        convertToBigInt(params.validatorRegistrationFee),
        convertToBigInt(params.providerRegistrationFee),
        convertToBigInt(params.offerRegistrationFee),
        convertToBigInt(params.termUpdateDelay),
        convertToBigInt(params.providerShare),
        convertToBigInt(params.validatorShare),
        convertToBigInt(params.pcOwnerShare),
        params.detailsLink,
      ],
    });

    await this.walletClient!.writeContract(request);

    return result;
  }

  async registerActor(
    type: ActorType,
    detailsLink: string,
    billingAddress?: Address,
    operatorAddress?: Address
  ) {
    this.checkClient();
    this.checkAccount();
    try {
      const { result, request } = await this.publicClient!.simulateContract({
        address: this.contract!.address,
        abi: this.contract!.abi,
        functionName: "registerActor",
        account: this.account!,
        args: [
          type,
          operatorAddress || ADDRESS_ZERO,
          billingAddress || ADDRESS_ZERO,
          detailsLink,
        ],
      });

      await this.walletClient!.writeContract(request);

      return result;
    } catch (err: any) {
      // Map ERC20 errors into native TypeScript errors if they are known ones.
      switch (err?.cause?.signature) {
        case BlockchainErrorSignatures.ERC20InsufficientAllowance:
          throw new InsufficientAllowance(this.contract!.address);
        case BlockchainErrorSignatures.ERC20InsufficientBalance:
          throw new InsufficientBalance();
      }

      // If it is not a known error, just re-throw it.
      throw err;
    }
  }

  private setupContracts(chain: ForestChain, options?: RegistryClientOptions) {
    this.registryAddress =
      options?.contractAddress ||
      getContractAddressByChain(chain, ForestRegistryAddress);

    this.contract = getContract({
      address: this.registryAddress,
      abi: RegistryABI,
      client: this.publicClient!,
    });

    this.walletClient = createWalletClient({
      transport: http(this.publicClient!.transport.url),
      account: this.account!,
      chain: this.publicClient!.chain,
    });
  }

  private checkClient() {
    if (!this.publicClient) {
      throw new NotInitialized("Public (read) client");
    }

    if (!this.contract) {
      throw new NotInitialized("Registry contract instance");
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
