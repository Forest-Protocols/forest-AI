import {
  Actor,
  ForestChain,
  ForestPublicClientType,
  RegistryInfo,
  ProtocolInfo,
  Provider,
  Validator,
} from "@/types";
import { generateCID } from "@/utils";
import { Account, Address } from "viem";
import { RegistryABI } from "./abi/registry";
import { Protocol } from "./Protocol";
import {
  ActorType,
  ADDRESS_ZERO,
  BlockchainErrorSignatures,
  ForestRegistryAddress,
} from "@/constants";
import { InsufficientAllowance } from "@/errors/InsufficientAllowance";
import { InsufficientBalance } from "@/errors/InsufficientBalance";
import { throttleRequest } from "@/throttle";
import { ContractClient, ContractClientOptions } from "./ContractClient";

/**
 * @deprecated
 */
export type RegistryClientOptions = {
  contractAddress?: Address;
};

export class Registry extends ContractClient<typeof RegistryABI> {
  /**
   * @deprecated Use `address` instead
   */
  registryAddress?: ForestRegistryAddress | Address;

  /**
   * Instantiates a new Registry client
   */
  constructor(options: ContractClientOptions) {
    super(RegistryABI, {
      ...options,
      addresses: ForestRegistryAddress,
    });
    this.registryAddress = this.address;
  }

  /**
   * @deprecated Use constructor instead
   */
  static create(
    chain: ForestChain,
    rpcHost: string,
    account?: Account,
    options?: RegistryClientOptions
  ) {
    const registry = new Registry({
      chain,
      rpcHost,
      account,
      address: options?.contractAddress,
    });

    registry.registryAddress = registry.address;
    return registry;
  }

  /**
   * @deprecated Use constructor instead
   */
  static createWithClient(
    client: ForestPublicClientType,
    account?: Account,
    options?: RegistryClientOptions
  ) {
    const registry = new Registry({
      client,
      account,
      address: options?.contractAddress,
    });

    registry.registryAddress = registry.address;

    return registry;
  }

  async getActor(address: Address): Promise<Actor | undefined> {
    const actor = await throttleRequest(() =>
      this.contract.read.getActor([address])
    );

    // If the owner address is zero, that means the actor not found
    if (actor.ownerAddr == ADDRESS_ZERO) {
      return;
    }

    return actor;
  }

  async getRegisteredPTsOfProvider(providerId: number) {
    const ptAddresses = await throttleRequest(() =>
      this.contract.read.getAllPtAddresses()
    );
    const pts: Address[] = [];

    for (const ptAddress of ptAddresses) {
      const pt = new Protocol({
        client: this.client,
        address: ptAddress,
      });
      const ids = await pt.getAllProviderIds();

      if (ids.find((id) => id == providerId)) {
        pts.push(ptAddress);
      }
    }

    return pts;
  }

  async getRegisteredPTsOfValidator(validatorId: number) {
    const ptAddresses = await throttleRequest(() =>
      this.contract.read.getAllPtAddresses()
    );
    const pct: Address[] = [];

    for (const ptAddress of ptAddresses) {
      const pt = new Protocol({
        client: this.client,
        address: ptAddress,
      });
      const ids = await pt.getAllValidatorIds();

      if (ids.find((id) => id == validatorId)) {
        pct.push(ptAddress);
      }
    }

    return pct;
  }

  async getAllProviders(): Promise<Provider[]> {
    return [
      ...(await throttleRequest(() => this.contract.read.getAllProviders())),
    ];
  }

  async getAllValidators(): Promise<Validator[]> {
    return [
      ...(await throttleRequest(() => this.contract.read.getAllValidators())),
    ];
  }

  async getActorCount(): Promise<bigint> {
    return await throttleRequest(() => this.contract.read.getActorCount());
  }

  /**
   * Gets the treasury address of the Registry.
   */
  async getTreasuryAddress() {
    return await throttleRequest(() => this.contract.read.getTreasuryAddr());
  }

  /**
   * Gets Forest Slasher address saved in the Registry.
   */
  async getSlasherAddress() {
    return await throttleRequest(() => this.contract.read.getSlasherAddr());
  }

  /**
   * Gets Forest Token address saved in the Registry.
   */
  async getTokenAddress() {
    return await throttleRequest(() => this.contract.read.getForestTokenAddr());
  }

  /**
   * Gets USDC Token address saved in the Registry.
   */
  async getUSDCAddress() {
    return await throttleRequest(() => this.contract.read.getUsdcTokenAddr());
  }

  /**
   * Gets the protocol information with its smart contract address.
   * @param address
   */
  async getProtocolInfo(address: Address): Promise<ProtocolInfo | undefined> {
    const pts = await throttleRequest(() =>
      this.contract.read.getAllPtAddresses()
    );
    const pt = pts.find((pcAddr) => pcAddr == address);

    if (!pt) {
      return;
    }

    const client = new Protocol({
      client: this.client,
      account: this.account,
      address: pt,
    });
    const info = await client.getInfo();

    return info;
  }

  async getAllProtocols() {
    const pts = await this.getAllProtocolsAddresses();
    return pts.map(
      (pt) =>
        new Protocol({
          client: this.client,
          account: this.account,
          address: pt,
        })
    );
  }

  async getAllProtocolsAddresses(): Promise<Address[]> {
    return [
      ...(await throttleRequest(() => this.contract.read.getAllPtAddresses())),
    ];
  }

  async getBurnRatio(): Promise<bigint> {
    return await throttleRequest(() => this.contract.read.getBurnRatio());
  }

  async getMaximumProtocolsCount(): Promise<bigint> {
    return await throttleRequest(() => this.contract.read.getMaxProtocolsNum());
  }

  async getOfferRegistrationFeeInPT(): Promise<bigint> {
    return await throttleRequest(() => this.contract.read.getOfferInPtRegFee());
  }

  async getTotalPTCount(): Promise<bigint> {
    return await throttleRequest(() => this.contract.read.getPtCount());
  }

  async getProvidersCount(): Promise<bigint> {
    return await throttleRequest(() => this.contract.read.getProvidersCount());
  }

  async getValidatorsCount(): Promise<bigint> {
    return await throttleRequest(() => this.contract.read.getValidatorsCount());
  }

  async getRevenueShare(): Promise<bigint> {
    return await throttleRequest(() => this.contract.read.getRevenueShare());
  }

  async getForestTokenAddress(): Promise<Address> {
    return await throttleRequest(() => this.contract.read.getForestTokenAddr());
  }

  async getSlasherContractAddress(): Promise<Address> {
    return await throttleRequest(() => this.contract.read.getSlasherAddr());
  }

  async getTreasureAddress(): Promise<Address> {
    return await throttleRequest(() => this.contract.read.getTreasuryAddr());
  }

  async isActorActive(addr: Address): Promise<boolean> {
    return await throttleRequest(() =>
      this.contract.read.isActiveActor([addr])
    );
  }

  /**
   * Gets protocol registration fee.
   */
  async getPTRegistrationFee(): Promise<bigint> {
    return await throttleRequest(() => this.contract.read.getPtRegFee());
  }

  async getActorRegistrationFeeInPT(): Promise<bigint> {
    return await throttleRequest(() => this.contract.read.getActorInPtRegFee());
  }

  async getActorRegistrationFee() {
    return await throttleRequest(() => this.contract.read.getActorRegFee());
  }

  async setActorInPTRegistrationFee(fee: bigint) {
    this.checkAccount();
    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "setActorInPtRegFee",
        account: this.account,
        args: [fee],
      })
    );

    await this.writeContract(request);
  }

  async setActorInProtocolRegistrationFee(fee: bigint) {
    this.checkAccount();
    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "setActorRegFee",
        account: this.account,
        args: [fee],
      })
    );

    await this.writeContract(request);
  }

  async setBurnRatio(ratio: bigint) {
    this.checkAccount();
    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "setBurnRatio",
        account: this.account,
        args: [ratio],
      })
    );

    await this.writeContract(request);
  }

  async setMaxPTCount(count: number | bigint) {
    this.checkAccount();
    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "setMaxProtocolsNum",
        account: this.account,
        args: [BigInt(count)],
      })
    );

    await this.writeContract(request);
  }

  async setOfferInPTRegistrationFee(fee: bigint) {
    this.checkAccount();
    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "setOfferInPtRegFee",
        account: this.account,
        args: [fee],
      })
    );

    await this.writeContract(request);
  }

  async setPTRegistrationFee(fee: bigint) {
    this.checkAccount();
    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "setPtRegFee",
        account: this.account,
        args: [fee],
      })
    );

    await this.writeContract(request);
  }

  async setRevenueShare(share: bigint) {
    this.checkAccount();
    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "setRevenueShare",
        account: this.account,
        args: [share],
      })
    );

    await this.writeContract(request);
  }

  async setTreasuryAddress(address: Address) {
    this.checkAccount();
    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "setTreasuryAddrParam",
        account: this.account,
        args: [address],
      })
    );

    await this.writeContract(request);
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
    this.checkAccount();

    if (typeof detailsLink !== "string") {
      detailsLink = await generateCID(detailsLink);
    }

    const { request } = await throttleRequest(() =>
      this.client.simulateContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "updateActorDetails",
        account: this.account,
        args: [
          type,
          operatorAddress || ADDRESS_ZERO,
          billingAddress || ADDRESS_ZERO,
          detailsLink,
        ],
      })
    );

    await this.writeContract(request);
  }

  /**
   * Pauses work of the protocol. Only can be called by the Admin.
   */
  async pauseProtocol() {
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
   * Unpauses work of the protocol. Only can be called by the Admin.
   */
  async unpauseProtocol() {
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

  /**
   * Gets Registry params/settings.
   */
  async getRegistryInfo(): Promise<RegistryInfo> {
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
      treasuryAddress,
      slasherAddress,
      forestTokenAddress,
      usdcAddress,
    ] = await Promise.all([
      throttleRequest(() => this.contract.read.getActorCount()),
      throttleRequest(() => this.contract.read.getProvidersCount()),
      throttleRequest(() => this.contract.read.getValidatorsCount()),
      throttleRequest(() => this.contract.read.getPtCount()),
      throttleRequest(() => this.contract.read.getMaxProtocolsNum()),
      throttleRequest(() => this.contract.read.getActorInPtRegFee()),
      throttleRequest(() => this.contract.read.getActorRegFee()),
      throttleRequest(() => this.contract.read.getBurnRatio()),
      throttleRequest(() => this.contract.read.getOfferInPtRegFee()),
      throttleRequest(() => this.contract.read.getPtRegFee()),
      throttleRequest(() => this.contract.read.getRevenueShare()),
      throttleRequest(() => this.contract.read.getTreasuryAddr()),
      throttleRequest(() => this.contract.read.getSlasherAddr()),
      throttleRequest(() => this.contract.read.getForestTokenAddr()),
      throttleRequest(() => this.contract.read.getUsdcTokenAddr()),
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
      treasuryAddress,
      slasherAddress,
      forestTokenAddress,
      usdcAddress,
    };
  }

  /**
   * Creates a new protocol inside the Registry.
   * @param params Parameters of the creation process
   * @returns Smart contract address of the newly created protocol.
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
    this.checkAccount();

    const convertToBigInt = (num: bigint | number) =>
      typeof num === "number" ? BigInt(num) : num;
    const { result, request } = await throttleRequest(() =>
      this.client.simulateContract({
        address: this.contract.address,
        abi: this.contract.abi,
        functionName: "createProtocol",
        account: this.account,
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
      })
    );

    await this.writeContract(request);

    return result;
  }

  async registerActor(
    type: ActorType,
    detailsLink: string,
    billingAddress?: Address,
    operatorAddress?: Address
  ) {
    this.checkAccount();
    try {
      const { result, request } = await throttleRequest(() =>
        this.client.simulateContract({
          address: this.contract.address,
          abi: this.contract.abi,
          functionName: "registerActor",
          account: this.account,
          args: [
            type,
            operatorAddress || ADDRESS_ZERO,
            billingAddress || ADDRESS_ZERO,
            detailsLink,
          ],
        })
      );

      await this.writeContract(request);
      return result;
    } catch (err: any) {
      // Map ERC20 errors into native TypeScript errors if they are known ones.
      switch (err?.cause?.signature) {
        case BlockchainErrorSignatures.ERC20InsufficientAllowance:
          throw new InsufficientAllowance(this.contract.address);
        case BlockchainErrorSignatures.ERC20InsufficientBalance:
          throw new InsufficientBalance();
      }

      // If it is not a known error, just re-throw it.
      throw err;
    }
  }
}
