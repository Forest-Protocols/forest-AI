import { createProtocolInstance } from "@/client";
import { createXMTPPipe, truncateAddress } from "@/utils";
import {
  DECIMALS,
  HUNDRED_PERCENT_POINTS,
  MONTH_IN_SECONDS,
  PipeError,
  PipeMethod,
  PipeResponseCode,
  Provider,
  ProviderDetails,
  XMTPv3Pipe,
} from "@forest-protocols/sdk";
import { green, yellow } from "ansis";
import { AsciiTable3 } from "ascii-table3";
import { Address, formatUnits } from "viem";
import { tokenomicsService } from "../network/tokenomics.service";
import {
  ProtocolsEpochInfoAggregated,
  ProviderTableData,
  ProviderWithTokensEmitted,
} from "@/commands/network/types";
import { slasherService } from "./slasher.service";
import { ActorService } from "./base-actor-service";
import { resolveToNames } from "@/utils/address";

class ProviderService extends ActorService {
  constructor() {
    super();
  }

  async getProvidersWithDetails(protocolAddr: Address) {
    try {
      const groupedByProtocolLogs =
        await tokenomicsService.getLogEventsForLastEmissionsEpochBlockNum();

      if (!groupedByProtocolLogs) {
        throw new Error("No logs found");
      }

      const protocolLogs = groupedByProtocolLogs.find(
        (pt) => pt.protocolAddr.toLowerCase() === protocolAddr.toLowerCase()
      );

      if (!protocolLogs) {
        throw new Error("No logs found for the given protocol address");
      }

      const protocol = createProtocolInstance(this.client, protocolAddr);
      const providers = await protocol.getAllProviders();
      const resolver = Promise.all(
        providers.map((p) =>
          resolveToNames([p.ownerAddr, p.operatorAddr, p.billingAddr])
        )
      );
      const { provider } = await protocol.getEmissionShares();

      const prvs = providers
        .map((prv) => {
          const log = protocolLogs.transfers.find(
            (log) => log.to.toLowerCase() === prv.billingAddr.toLowerCase()
          );

          if (!log) {
            return {
              ...prv,
              tokensEmitted: BigInt(0),
            };
          }
          const isProvider = prv?.actorType === 1;
          if (!isProvider) {
            return null;
          }

          return {
            ...prv,
            tokensEmitted: log.value,
          };
        })
        .filter(Boolean) as ProviderWithTokensEmitted[];

      const aggregatedResults =
        await slasherService.fetchLastClosedEpochResults();

      const filteredByProtocolAggregatedResults = aggregatedResults?.filter(
        (item) => item.ptAddr.toLowerCase() === protocolAddr.toLowerCase()
      );

      const pipe = await createXMTPPipe();
      const results = await Promise.all(
        prvs.map(async (p) => {
          const rankEntry = slasherService.getProviderRank(
            filteredByProtocolAggregatedResults as ProtocolsEpochInfoAggregated[],
            p?.id
          );

          const score = rankEntry ? rankEntry.rank : BigInt(0);

          const name = (await this.fetchProviderDetails(pipe, p)) || "* N/A";

          const tokensEmitted =
            Number(
              formatUnits(p.tokensEmitted as bigint, DECIMALS.FOREST)
            ).toFixed(2) || "0";

          const tvs = await protocol.getActorTvs(p.billingAddr as Address);
          const revenue = tvs
            ? (
                Number(formatUnits(tvs, DECIMALS.USDC)) *
                Number(MONTH_IN_SECONDS)
              ).toFixed(2)
            : "0.00";

          return {
            id: String(p?.id) || "* N/A",
            name,
            rank: score.toString() || "* N/A",
            basename: await truncateAddress(p.ownerAddr),
            tokensEmitted,
            revenue,
          };
        })
      );
      const providerSharesInPercentage =
        (Number(provider) / Number(HUNDRED_PERCENT_POINTS)) * 100;

      await resolver;
      return {
        protocolEmission:
          Number(
            formatUnits(
              protocolLogs.totalTokensEmittedPerProtocol,
              DECIMALS.FOREST
            )
          ).toFixed(2) || "N/A *",
        data: results,
        shares: {
          provider: providerSharesInPercentage.toFixed(2),
        },
      };
    } catch (error) {
      throw new Error(`Failed to fetch providers data: ${error}`);
    }
  }
  async fetchProviderDetails(pipe: XMTPv3Pipe, provider: Provider) {
    try {
      try {
        const res = await pipe.send(provider.operatorAddr, {
          method: PipeMethod.GET,
          path: "/details",
          timeout: 10 * 1000,
          body: [provider.detailsLink],
        });

        if (res.code != PipeResponseCode.OK) {
          throw new PipeError(res.code, res.body);
        }

        const [detailFile] = res.body;
        const { name } = JSON.parse(detailFile) as ProviderDetails;

        return name;
      } catch {
        // spinner.fail(
        //   red(
        //     `Provider (${await truncateAddress(
        //       provider.ownerAddr!
        //     )}) details could not be retrieved from ${await truncateAddress(
        //       provider.operatorAddr
        //     )}`
        //   )
        // );
        // spinner.start();
      }
    } catch {
      // spinner.fail(
      //   red(
      //     `Provider (${await truncateAddress(
      //       provider.ownerAddr!
      //     )}) details could not be retrieved`
      //   )
      // );
      // spinner.start();
    }
  }
  showProvidersTableOutput(
    title: string,
    headings: string[],
    data: ProviderTableData,
    totalTokensEmissionPerEpoch: number,
    lastEmittedEpochBlockNum: number
  ) {
    const { protocolEmission, shares, data: providers } = data;
    const isNotAvailable = providers.some((e) => e.name === "* N/A");

    console.log(green(`Epoch Number: ${lastEmittedEpochBlockNum}`));
    console.log(green(`Max Emissions: ${totalTokensEmissionPerEpoch} FOREST`));
    console.log(green(`Protocol Emissions: ${protocolEmission} FOREST`));
    console.log(green(`Max Providers Share: ${shares.provider} %`));

    const table = new AsciiTable3(title).setHeading(...headings);

    providers.sort((a, b) => Number(a.tokensEmitted) - Number(b.tokensEmitted));

    for (let i = 0; i < providers.length; i++) {
      const row = providers[i];
      table.addRowMatrix([
        [
          row.id,
          row.name === "* N/A" ? yellow(row.name) : row.name,
          row.basename,
          row.rank,
          Number(row.tokensEmitted),
          row.revenue,
        ],
      ]);
    }
    table.sortColumnDesc(4);

    console.log(table.toString());
    if (isNotAvailable) {
      console.log(yellow("* Name couldn't be fetched from the Protocol"));
    }
  }
}
export const providerService = new ProviderService();
