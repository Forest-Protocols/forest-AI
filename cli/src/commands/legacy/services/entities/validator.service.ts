import {
  ActorDetails,
  DECIMALS,
  HUNDRED_PERCENT_POINTS,
  PipeError,
  PipeMethod,
  PipeResponseCode,
  Validator,
  XMTPv3Pipe,
} from "@forest-protocols/sdk";
import { createXMTPPipe } from "@/utils";
import { ActorService } from "./base-actor-service";
import { Address, formatUnits } from "viem";
import { tokenomicsService } from "../network/tokenomics.service";
import { createProtocolInstance } from "@/client";
import {
  ProtocolsEpochInfoAggregated,
  ValidatorTableData,
  ValidatorWithTokensEmitted,
} from "@/commands/network/types";
import { slasherService } from "./slasher.service";
import { green, yellow } from "ansis";
import { AsciiTable3 } from "ascii-table3";

class ValidatorService extends ActorService {
  constructor() {
    super();
  }
  async getValidatorsWithDetails(protocolAddr: Address) {
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
      const validators = await protocol.getAllValidators();
      const { validator: validatorShare } = await protocol.getEmissionShares();

      const vlds = validators.map((vld) => {
        const log = protocolLogs.transfers.find(
          (log) => log.to.toLowerCase() === vld.billingAddr.toLowerCase()
        );

        if (!log) {
          return {
            ...vld,
            tokensEmitted: BigInt(0),
          };
        }
        const isValidator = vld?.actorType === 2;
        if (!isValidator) {
          return null;
        }

        return {
          ...vld,
          tokensEmitted: log.value,
        };
      }) as ValidatorWithTokensEmitted[];

      const aggregatedResults =
        await slasherService.fetchLastClosedEpochResults();
      const filteredByProtocolAggregatedResults = aggregatedResults?.filter(
        (item) => item.ptAddr.toLowerCase() === protocolAddr.toLowerCase()
      );

      const pipe = await createXMTPPipe();
      const results = await Promise.all(
        vlds.map(async (p) => {
          const rankEntry = slasherService.getValidatorRank(
            filteredByProtocolAggregatedResults as ProtocolsEpochInfoAggregated[],
            p?.id as number
          );

          const score = rankEntry ? rankEntry.rank : BigInt(0);

          const name = (await this.fetchValidatorDetails(pipe, p)) || "* N/A";

          const tokensEmitted =
            Number(
              formatUnits(p?.tokensEmitted as bigint, DECIMALS.FOREST)
            ).toFixed(2) || "0";

          return {
            id: String(p?.id) || "* N/A",
            name,
            rank: score.toString() || "* N/A",
            tokensEmitted,
          };
        })
      );
      const validatorShareInPercentage =
        (Number(validatorShare) / Number(HUNDRED_PERCENT_POINTS)) * 100;

      return {
        protocolEmission:
          Number(
            formatUnits(
              protocolLogs.totalTokensEmittedPerProtocol,
              DECIMALS.FOREST
            )
          ).toFixed(2) || "N/A * ",
        data: results,
        shares: {
          validator: validatorShareInPercentage.toFixed(2),
        },
      };
    } catch (error) {
      throw new Error(`Failed to fetch providers data: ${error}`);
    }
  }
  async fetchValidatorDetails(pipe: XMTPv3Pipe, validator: Validator) {
    try {
      try {
        const res = await pipe.send(validator.operatorAddr, {
          method: PipeMethod.GET,
          path: "/details",
          timeout: 10 * 1000,
          body: [validator.detailsLink],
        });

        if (res.code != PipeResponseCode.OK) {
          throw new PipeError(res.code, res.body);
        }

        const [detailFile] = res.body;
        const { name } = JSON.parse(detailFile) as ActorDetails;

        return name;
      } catch {
        // spinner.fail(
        //   red(
        //     `Validator (${await truncateAddress(
        //       validator.ownerAddr!
        //     )}) details could not be retrieved from ${await truncateAddress(
        //       validator.operatorAddr
        //     )}`
        //   )
        // );
        // spinner.start();
      }
    } catch {
      // spinner.fail(
      //   red(
      //     `Validator (${await truncateAddress(
      //       validator.ownerAddr!
      //     )}) details could not be retrieved`
      //   )
      // );
      // spinner.start();
    }
  }
  showValidatorsTableData(
    title: string,
    headings: string[],
    data: ValidatorTableData,
    lastEmittedEpochBlockNum: number,
    totalTokensEmissionPerEpoch: number
  ) {
    const { protocolEmission, shares, data: validators } = data;
    const isNotAvailable = validators.some((e) => e.name === "* N/A");

    console.log(green(`Epoch Number: ${lastEmittedEpochBlockNum}`));
    console.log(green(`Max Emissions: ${totalTokensEmissionPerEpoch} FOREST`));
    console.log(green(`Protocol Emissions: ${protocolEmission} FOREST`));
    console.log(green(`Max Validators Share: ${shares.validator} %`));

    const table = new AsciiTable3(title).setHeading(...headings);

    for (let i = 0; i < validators.length; i++) {
      const row = validators[i];
      table.addRowMatrix([
        [
          row.id,
          row.name === "* N/A" ? yellow(row.name) : row.name,
          row.rank,
          Number(row.tokensEmitted),
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

export const validatorService = new ValidatorService();
