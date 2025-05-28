import { spinner } from "@/program";

import {
  createViemPublicClient,
  createXMTPPipe,
  truncateAddress,
} from "@/utils";
import {
  ActorDetails,
  DECIMALS,
  ForestPublicClientType,
  MONTH_IN_SECONDS,
  PipeError,
  PipeMethod,
  PipeResponseCode,
  Protocol,
  Provider,
  Registry,
  XMTPv3Pipe,
} from "@forest-protocols/sdk";

import { green, red, yellow } from "ansis";
import { AsciiTable3 } from "ascii-table3";
import { tokenomicsService } from "../network/tokenomics.service";
import { Address, formatUnits } from "viem";
import { createRegistryInstance } from "@/client";
import { ProtocolTableData } from "@/commands/network/types";

class ProtocolService {
  private registry: Registry;
  private client: ForestPublicClientType;
  constructor() {
    this.client = createViemPublicClient();
    this.registry = createRegistryInstance(this.client);
  }

  async getProtocolsWithDetails() {
    const pts = await this.registry.getAllProtocols();
    const logs = await tokenomicsService.getProtocolsLogsOnRewardsMintedEvent();
    const totalRevenue = logs.reduce((acc, log) => {
      return (
        acc +
        Number(
          formatUnits(log.args.revenueAtEpochClose as bigint, DECIMALS.USDC)
        ) *
          Number(MONTH_IN_SECONDS)
      );
    }, 0);

    const pipe = await createXMTPPipe();
    return await Promise.all(
      logs.map(async (log) => {
        const protocolAddress = log.args.ptAddr as Address;
        const protocol = pts.find((p) => p.address === protocolAddress);

        const providers = await protocol?.getAllProviders();
        const name = await this.fetchProtocolDetails(
          pipe,
          protocol as Protocol,
          providers as Provider[]
        );
        const protocolRevenueInUSDC =
          tokenomicsService.getProtocolRevenueConvertedToUSDC(
            log.args.revenueAtEpochClose as bigint
          ) * Number(MONTH_IN_SECONDS);
        const protocolTokensShare =
          (protocolRevenueInUSDC / totalRevenue) * 100;
        const address = (await truncateAddress(protocolAddress)) || "* N/A";
        const tokensEmitted =
          Number(
            formatUnits(log.args.totalTokensEmitted as bigint, DECIMALS.FOREST)
          ).toFixed() || "* N/A";
        const percentageOfTheTokensEmission =
          protocolTokensShare.toFixed(2) || "* N/A";
        const revenue = protocolRevenueInUSDC.toFixed(2) || "* N/A";

        return {
          name: name ?? "* N/A",
          address,
          percentageOfTheTokensEmission,
          tokensEmitted,
          revenue,
        };
      })
    );
  }

  async fetchProtocolsData() {
    return await this.getProtocolsWithDetails();
  }

  async fetchProtocolDetails(
    pipe: XMTPv3Pipe,
    protocol: Protocol,
    providers: Provider[]
  ) {
    try {
      if (providers.length == 0) {
        spinner.warn(
          yellow(
            `Protocol ${await truncateAddress(
              protocol.address!
            )} doesn't have any registered Actors yet`
          )
        );
        spinner.start();
        return;
      }

      const operatorAddresses = [
        ...new Set(providers.map((prov) => prov.operatorAddr)),
      ];

      for (let i = 0; i < operatorAddresses.length; i++) {
        const operatorAddress = operatorAddresses[i];
        try {
          const res = await pipe.send(operatorAddress, {
            method: PipeMethod.GET,
            path: "/details",
            timeout: 10 * 1000,
            body: [await protocol.getDetailsLink()],
          });

          if (res.code != PipeResponseCode.OK) {
            throw new PipeError(res.code, res.body);
          }

          const [detailFile] = res.body;
          const { name } = JSON.parse(detailFile) as ActorDetails;

          return name;
        } catch {
          /*   spinner.fail(
            red(
              `Protocol (${truncateAddress(
                protocol.address!
              )}) details could not be retrieved from ${truncateAddress(
                operatorAddress
              )}${i != operatorAddresses.length - 1 ? ", trying next one" : ""}`
            )
          );
          spinner.start(); */
        }
      }
    } catch {
      spinner.fail(
        red(
          `Protocol (${await truncateAddress(
            protocol.address!
          )}) details could not be retrieved`
        )
      );
      spinner.start();
    }
  }
  showProtocolsTableOutput(
    title: string,
    headings: string[],
    data: ProtocolTableData[],
    lastEpochBlockNumber: number,
    totalTokensEmissionPerEpoch: number
  ) {
    console.log(green(`Epoch Number: ${lastEpochBlockNumber}`));
    console.log(
      green(`Total Emissions: ${totalTokensEmissionPerEpoch} FOREST`)
    );
    const isNotAvailable = data.some((e) => e.name === "* N/A");
    const table = new AsciiTable3(title).setHeading(...headings);

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      table.addRowMatrix([
        [
          row.name === "* N/A" ? yellow(row.name) : row.name,
          row.address,
          row.percentageOfTheTokensEmission,
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
export const protocolService = new ProtocolService();
