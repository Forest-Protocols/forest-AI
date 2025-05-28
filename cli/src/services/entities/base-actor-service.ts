import {
  ActorDetails,
  DECIMALS,
  ForestPublicClientType,
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
import { createViemPublicClient, createXMTPPipe } from "@/utils";
import { spinner } from "@/program";
import { green, red, yellow } from "ansis";

import { AsciiTable3 } from "ascii-table3";
import { ActorTableData, ExtendedActor } from "@/commands/network/types";
import { tokenomicsService } from "../network/tokenomics.service";
import { createProtocolInstance } from "@/client";
import { Address, formatUnits } from "viem";

export class ActorService {
  client: ForestPublicClientType;
  constructor() {
    this.client = createViemPublicClient();
  }
  async getActorsWithDetails(protocolAddr: Address) {
    try {
      const groupedActorProtocolLogs =
        await tokenomicsService.getLogEventsForLastEmissionsEpochBlockNum();

      if (!groupedActorProtocolLogs) {
        throw new Error("No logs found");
      }

      const protocolLogs = groupedActorProtocolLogs.find(
        (pt) => pt.protocolAddr.toLowerCase() === protocolAddr.toLowerCase()
      );

      if (!protocolLogs) {
        throw new Error("No logs found for the given protocol address");
      }

      const protocol = createProtocolInstance(this.client, protocolAddr);
      const providers = await protocol.getAllProviders();
      const actors = await protocol.getAllActorsOnProtocol();
      const mappedAcctors = actors.map((actor) => {
        const {
          id,
          actorType,
          ownerAddr,
          operatorAddr,
          billingAddr,
          detailsLink,
        } = actor;
        const role =
          actorType === 1
            ? "Provider"
            : actorType === 2
            ? "Validator"
            : actorType === 3
            ? "Protocol Owner"
            : "Unknown";
        const emissions = protocolLogs.transfers.find(
          (e) => e.to === billingAddr
        );
        return {
          id,
          ownerAddr,
          operatorAddr,
          billingAddr,
          role,
          detailsLink,
          tokensEmitted: emissions?.value || BigInt(0),
        };
      });

      const {
        pcOwner: ptOwner,
        provider,
        validator,
      } = await protocol.getEmissionShares();

      const providerSharesInPercentage =
        (Number(provider) / Number(HUNDRED_PERCENT_POINTS)) * 100;
      const protocolOwnerSharesInPercentage =
        (Number(ptOwner) / Number(HUNDRED_PERCENT_POINTS)) * 100;
      const validatorSharesInPercentage =
        (Number(validator) / Number(HUNDRED_PERCENT_POINTS)) * 100;

      const pipe = await createXMTPPipe();
      const results = await Promise.all(
        mappedAcctors.map(async (actor) => {
          let name: string | undefined;
          if (actor.role === "Protocol Owner") {
            name = await this.fetchProtocolOwnerDetails(
              pipe,
              actor as unknown as ProtocolOwner,
              protocol,
              providers
            );
          } else {
            name = await this.fetchActorDetails(pipe, actor);
          }

          const tokensEmitted =
            Number(
              formatUnits(actor.tokensEmitted as bigint, DECIMALS.FOREST)
            ).toFixed(2) || "0";
          return {
            id: String(actor?.id) || "* N/A",
            name: name || "* N/A",
            address: actor.ownerAddr as Address,
            role: actor.role,
            tokensEmitted,
          };
        })
      );

      return {
        protocolEmission:
          Number(
            formatUnits(
              protocolLogs.totalTokensEmittedPerProtocol,
              DECIMALS.FOREST
            )
          ).toFixed(2) || "N/A",
        data: results,
        shares: {
          protocolOwner: protocolOwnerSharesInPercentage.toFixed(2),
          provider: providerSharesInPercentage.toFixed(2),
          validator: validatorSharesInPercentage.toFixed(2),
        },
      };
    } catch (error) {
      throw new Error(`Failed to fetch providers data: ${error}`);
    }
  }

  async fetchActorDetails(pipe: XMTPv3Pipe, actor: ExtendedActor) {
    try {
      try {
        const res = await pipe.send(actor.operatorAddr, {
          method: PipeMethod.GET,
          path: "/details",
          timeout: 10 * 1000,
          body: [actor.detailsLink],
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
            `${actor.role} (${await truncateAddress(
              actor.ownerAddr!
            )}) details could not be retrieved from ${await truncateAddress(
              actor.operatorAddr
            )}`
          )
        );
        spinner.start();
      }
    } catch {
      spinner.fail(
        red(
          `${actor.role} (${await truncateAddress(
            actor.ownerAddr!
          )}) details could not be retrieved`
        )
      );
      spinner.start();
    }
  }

  showActorsTableData(
    title: string,
    headings: string[],
    data: ActorTableData,
    totalTokensEmissionPerEpoch: number,
    lastEmittedEpochBlockNum: number
  ) {
    const { protocolEmission, shares, data: actors } = data;
    const isNotAvailable = actors.some((e) => e.name === "* N/A");

    console.log(green(`Epoch Number: ${lastEmittedEpochBlockNum}`));
    console.log(
      green(`Total Emissions: ${totalTokensEmissionPerEpoch} FOREST`)
    );
    console.log(green(`Protocol Emissions: ${protocolEmission} FOREST`));
    console.log(green(`Protocol Owner Share: ${shares.protocolOwner} %`));

    console.log(green(`Protocol Providers Share: ${shares.provider} %`));
    console.log(green(`Protocol Validators Share: ${shares.validator} %`));

    const table = new AsciiTable3(title).setHeading(...headings);

    for (let i = 0; i < actors.length; i++) {
      const row = actors[i];
      table.addRowMatrix([
        [
          row.id,
          row.name === "* N/A" ? yellow(row.name) : row.name,
          row.address,
          row.role,
          Number(row.tokensEmitted),
        ],
      ]);
    }
    table.sortColumnDesc(5);
    console.log(table.toString());
    if (isNotAvailable) {
      console.log(yellow("* Name couldn't be fetched from the Protocol"));
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
}
export const actorService = new ActorService();
