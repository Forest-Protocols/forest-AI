import { createTokenInstance } from "@/client";
import { createViemPublicClient } from "@/utils";
import {
  DECIMALS,
  ForestPublicClientType,
  ForestTokenABI,
  Token,
} from "@forest-protocols/sdk";
import { Address, formatUnits } from "viem";
import { slasherService } from "../entities/slasher.service";

type LogEventsGroupedForLastEmittedBlockNum = {
  protocolAddr: Address;
  transfers: {
    from: Address;
    to: Address;
    value: bigint;
  }[];
  totalTokensEmittedPerProtocol: bigint;
};

class TokenomicsService {
  private token: Token;
  private client: ForestPublicClientType;
  constructor() {
    this.client = createViemPublicClient();
    this.token = createTokenInstance(this.client);
  }

  get tokenInstance() {
    return this.token;
  }
  async getEpochScoresAggregated() {
    const slasherInstance = slasherService.slasherInstance;
    const lastEpochBlockNumber = await this.token.getLastEmittedEpochBlockNum();
    const results = await slasherInstance.getEpochScoresAggregated(
      lastEpochBlockNumber
    );
    const protocolEpochScoresResults = results.map((result) => {
      return {
        ptAddr: result.ptAddr,
        revenueAtEpochClose: result.revenueAtEpochClose,
        provRanks: result.provRanks.map((prv) => ({
          id: prv[0],
          rank: prv[1],
        })),
        valRanks: result.valRanks.map((val) => ({
          id: val[0],
          rank: val[1],
        })),
      };
    });
    return protocolEpochScoresResults;
  }

  async getLastEmissionsEpochBlockNum() {
    return Number(await this.token.getLastEmissionsEpochBlockNum());
  }
  async getLastEmittedEpochBlockNum() {
    return Number(await this.token.getLastEmittedEpochBlockNum());
  }

  async getCurrentTokenEmissionConvertedToDecimals() {
    return Number(
      formatUnits(
        await this.token.calculateCurrentTokensEmission(),
        DECIMALS.FOREST
      )
    );
  }
  getProtocolRevenueConvertedToUSDC(revenueAtEpochClose: bigint) {
    return Number(formatUnits(revenueAtEpochClose, DECIMALS.USDC));
  }

  async getLogEventsForLastEmissionsEpochBlockNum() {
    const fromBlock = await this.token.getLastEmissionsEpochBlockNum();
    let transferLogs: { from: Address; to: Address; value: bigint }[] = [];
    const groupedLogs: LogEventsGroupedForLastEmittedBlockNum[] = [];

    const logs = await this.client.getContractEvents({
      abi: ForestTokenABI,
      fromBlock,
      toBlock: fromBlock,
    });
    for (const log of logs) {
      if (log.eventName === "Transfer") {
        transferLogs.push({
          from: log.args.from as Address,
          to: log.args.to as Address,
          value: log.args.value as bigint,
        });
      } else if (log.eventName === "RewardsMinted") {
        const protocolAddress = log.args.ptAddr as Address;
        groupedLogs.push({
          protocolAddr: protocolAddress,
          transfers: transferLogs,
          totalTokensEmittedPerProtocol: log.args.totalTokensEmitted as bigint,
        });
        transferLogs = [];
      }
    }

    return groupedLogs;
  }

  async getProtocolsLogsOnRewardsMintedEvent() {
    const fromBlock = await this.token.getLastEmissionsEpochBlockNum();
    const logs = await this.client.getContractEvents({
      abi: ForestTokenABI,
      eventName: "RewardsMinted",
      fromBlock,
      toBlock: fromBlock,
    });

    return logs;
  }
}

export const tokenomicsService = new TokenomicsService();
