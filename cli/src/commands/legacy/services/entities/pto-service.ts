import { Address, formatUnits } from "viem";
import { ActorService } from "./base-actor-service";
import { tokenomicsService } from "../network/tokenomics.service";
import { createProtocolInstance, createRegistryInstance } from "@/client";
import { ProtocolOwnerTableData } from "@/commands/network/types";
import { createXMTPPipe } from "@/utils";
import {
  ActorDetails,
  DECIMALS,
  HUNDRED_PERCENT_POINTS,
  PipeError,
  PipeMethod,
  PipeResponseCode,
  Protocol,
  ProtocolOwner,
  Provider,
  truncateAddress,
  XMTPv3Pipe,
} from "@forest-protocols/sdk";
import { spinner } from "@/program";
import { green, red, yellow } from "ansis";
import { AsciiTable3 } from "ascii-table3";

class ProtocolOwnerService extends ActorService {
  constructor() {
    super();
  }
  async getProtocolOwnerWithDetails(protocolAddr: Address) {
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

      const registry = createRegistryInstance(this.client);
      const protocol = createProtocolInstance(this.client, protocolAddr);
      const providers = await protocol.getAllProviders();
      const protocolOwnerAddr = await protocol.getOwnerAddress();
      const protocolOwner = await registry.getActor(protocolOwnerAddr);
      const protocolOwnerEmission = protocolLogs.transfers.find(
        (log) => protocolOwner?.billingAddr === log.to
      );

      const pipe = await createXMTPPipe();
      const name = await this.fetchProtocolOwnerDetails(
        pipe,
        protocolOwner as ProtocolOwner,
        protocol,
        providers
      );
      const { pcOwner: protocolOwnerShare } =
        await protocol.getEmissionShares();
      const tokensEmitted =
        Number(
          formatUnits(protocolOwnerEmission?.value as bigint, DECIMALS.FOREST)
        ).toFixed(2) || "0";

      const protocolOwnerShareInPercentage =
        (Number(protocolOwnerShare) / Number(HUNDRED_PERCENT_POINTS)) * 100;

      return {
        protocolEmission:
          Number(
            formatUnits(
              protocolLogs.totalTokensEmittedPerProtocol,
              DECIMALS.FOREST
            )
          ).toFixed(2) || "* N/A",
        data: {
          id: String(protocolOwner?.id) || "* N/A",
          name: name || "* N/A",
          tokensEmitted: tokensEmitted || "0",
        },
        shares: {
          protocolOwner: protocolOwnerShareInPercentage.toFixed(2),
        },
      };
    } catch (error) {
      throw new Error(`Failed to fetch providers data: ${error}`);
    }
  }

  async fetchProtocolOwnerDetails(
    pipe: XMTPv3Pipe,
    protocolOwner: ProtocolOwner,
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
            body: [protocolOwner.detailsLink],
          });

          if (res.code != PipeResponseCode.OK) {
            throw new PipeError(res.code, res.body);
          }

          const [detailFile] = res.body;
          const { name } = JSON.parse(detailFile) as ActorDetails;

          return name;
        } catch {
          spinner.fail(
            red(
              `Protocol Owner (${await truncateAddress(
                protocolOwner.ownerAddr!
              )}) details could not be retrieved from ${await truncateAddress(
                operatorAddress
              )}${i != operatorAddresses.length - 1 ? ", trying next one" : ""}`
            )
          );
          spinner.start();
        }
      }
    } catch {
      spinner.fail(
        red(
          `Protocol Owner (${await truncateAddress(
            protocolOwner.ownerAddr!
          )}) details could not be retrieved`
        )
      );
      spinner.start();
    }
  }
  showProtocolOwnersTableData(
    title: string,
    headings: string[],
    data: ProtocolOwnerTableData,
    lastEmittedEpochBlockNum: number,
    totalTokensEmissionPerEpoch: number
  ) {
    const {
      protocolEmission,
      shares,
      data: { id, name, tokensEmitted },
    } = data;
    const isNotAvailable = name === "* N/A";
    console.log(green(`Epoch Number: ${lastEmittedEpochBlockNum}`));
    console.log(green(`Max Emissions: ${totalTokensEmissionPerEpoch} FOREST`));
    console.log(green(`Protocol Emissions: ${protocolEmission} FOREST`));
    console.log(green(`Max Protocol Owner Share: ${shares.protocolOwner} %`));

    const table = new AsciiTable3(title).setHeading(...headings);

    table.addRowMatrix([
      [id, name === "* N/A" ? yellow(name) : name, Number(tokensEmitted)],
    ]);
    table.sortColumnDesc(4);
    console.log(table.toString());
    if (isNotAvailable) {
      console.log(yellow("* Name couldn't be fetched from the Protocol"));
    }
  }
}
export const protocolOwnerService = new ProtocolOwnerService();
