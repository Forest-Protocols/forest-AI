import { ProtocolOwner, Provider, Validator } from "@forest-protocols/sdk";
import { Address } from "viem";

export type EmissionsOptions = {
  protocol: string;
  pto: boolean;
  provider: boolean;
  validator: boolean;
  save: string;
};

export type ProtocolTableData = {
  name: string;
  address: string;
  percentageOfTheTokensEmission: string;
  tokensEmitted: string;
  revenue: string;
};

export type ProviderTableData = {
  protocolEmission: string;
  shares: {
    provider: string;
  };
  data: {
    id: string;
    name: string;
    rank: string;
    basename: string;
    tokensEmitted: string;
    revenue: string;
  }[];
};
export type ValidatorTableData = {
  protocolEmission: string;
  shares: {
    validator: string;
  };
  data: {
    id: string;
    name: string;
    rank: string;
    tokensEmitted: string;
  }[];
};
export type ProtocolOwnerTableData = {
  protocolEmission: string;
  shares: {
    protocolOwner: string;
  };
  data: {
    id: string;
    name: string;
    tokensEmitted: string;
  };
};

export type ActorTableData = {
  protocolEmission: string;
  shares: {
    protocolOwner: string;
    provider: string;
    validator: string;
  };
  data: {
    id: string;
    address: string;
    role: string;
    name: string;
    tokensEmitted: string;
  }[];
};

export type ProtocolsEpochInfoAggregated = {
  ptAddr: `0x${string}`;
  revenueAtEpochClose: bigint;
  provRanks: { id: bigint; rank: bigint }[];
  valRanks: {
    id: bigint;
    rank: bigint;
  }[];
};

export type ProviderWithTokensEmitted = Provider & {
  tokensEmitted: bigint;
};
export type ValidatorWithTokensEmitted = Validator & {
  tokensEmitted: bigint;
};
export type ProtocolOwnerWithTokensEmitted = ProtocolOwner & {
  tokensEmitted: bigint;
};

export type ExtendedActor = {
  id: number;
  role: string;
  ownerAddr: Address;
  billingAddr: Address;
  operatorAddr: Address;
  detailsLink: string;
  tokensEmitted: bigint | string;
};
