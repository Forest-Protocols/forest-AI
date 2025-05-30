import { networkCommand } from ".";
import { addressSchema } from "@forest-protocols/sdk";
import { spinner } from "@/program";
import { checkValidationError } from "@/validation/error-handling";
import {
  ActorTableData,
  EmissionsOptions,
  ProtocolOwnerTableData,
  ProtocolTableData,
  ProviderTableData,
  ValidatorTableData,
} from "./types";
import { providerService } from "@/services/entities/provider.service";
import { protocolService } from "@/services/entities/protocol.service";
import { tokenomicsService } from "@/services/network/tokenomics.service";
import { CSV } from "@/utils/csv";
import { actorService } from "@/services/entities/base-actor-service";
import { boolean } from "zod";
import { validatorService } from "@/services/entities/validator.service";
import { protocolOwnerService } from "@/services/entities/pto-service";

networkCommand
  .command("emissions")
  .description("Shows of the emissions of the Network")
  .option(
    "--protocol <address>",
    "Show all emissions for protocol owners, providers and validators of a specific protocol"
  )
  .option(
    "--provider",
    "Show all emissions for providers of a specific protocol (required to call --protocol with <address>)"
  )
  .option(
    "--validator",
    "Show all emissions for validators of a specific protocol (required to call --protocol with <address>)"
  )
  .option(
    "--pto",
    "Show all emissions for pto of a specific protocol (required to call --protocol with <address>)"
  )
  .option(
    "--save <output>",
    "Save the emissions for protocols/providers output to a file"
  )
  .action(async (options: EmissionsOptions) => {
    const address = checkValidationError(
      addressSchema.optional().safeParse(options.protocol)
    );
    const isProvider = checkValidationError(
      boolean().optional().safeParse(options.provider)
    );
    const isValidator = checkValidationError(
      boolean().optional().safeParse(options.validator)
    );
    const isProtocolOwner = checkValidationError(
      boolean().optional().safeParse(options.pto)
    );

    if (!address && (isProvider || isValidator || isProtocolOwner)) {
      throw new Error(
        "Error: --provider, --validator, and --pto options require --protocol <address> to be specified."
      );
    }

    spinner.start("Reading blockchain data");

    const [lastEmittedEpochBlockNum, totalTokensEmissionPerEpoch] =
      await Promise.all([
        tokenomicsService.getLastEmittedEpochBlockNum(),
        tokenomicsService.getCurrentTokenEmissionConvertedToDecimals(),
      ]);

    let protocolsTableData: ProtocolTableData[] = [];
    let providersTableData: ProviderTableData | null = null;
    let validatorsTableData: ValidatorTableData | null = null;
    let actorsTableData: ActorTableData | null = null;
    let protocolOwnerTableData: ProtocolOwnerTableData | null = null;

    if (!address && !isProvider && !isValidator && !isProtocolOwner) {
      protocolsTableData = await protocolService.getProtocolsWithDetails();

      if (!protocolsTableData.length) {
        throw new Error("Failed to fetch protocols data");
      }
      spinner.stop();

      const headers = [
        "Name",
        "Address",
        "Share of Emissions (%)",
        "Token Emission (FOREST)",
        "Total Revenue ($)",
      ];

      protocolService.showProtocolsTableOutput(
        "Protocols Emissions",
        headers,
        protocolsTableData,
        lastEmittedEpochBlockNum,
        totalTokensEmissionPerEpoch
      );
      if (options.save) {
        spinner.start("Saving data to CSV");
        CSV.fromJSON(protocolsTableData || []).save(
          headers,
          `protocols-emissions-by-epoch-${lastEmittedEpochBlockNum}`,
          options.save
        );
      }
    }
    if (address) {
      if (!isProvider && !isValidator && !isProtocolOwner) {
        actorsTableData = await actorService.getActorsWithDetails(address);
        spinner.stop();

        const headers = [
          "ID",
          "Name",
          "Address",
          "Role",
          "Token Emission (FOREST)",
        ];
        actorService.showActorsTableData(
          "Protocol Emissions",
          headers,
          actorsTableData,
          totalTokensEmissionPerEpoch,
          lastEmittedEpochBlockNum
        );

        if (options.save) {
          spinner.start("Saving data to CSV");
          CSV.fromJSON(actorsTableData.data || []).save(
            headers,
            `all-actors-protocol-emission-by-epoch-${lastEmittedEpochBlockNum}`,
            options.save
          );
        }
      }
      if (isProtocolOwner) {
        protocolOwnerTableData =
          await protocolOwnerService.getProtocolOwnerWithDetails(address);
        spinner.stop();
        const headers = ["ID", "Name", "Token Emission (FOREST)"];

        protocolOwnerService.showProtocolOwnersTableData(
          "Protocol Owner Emission",
          headers,
          protocolOwnerTableData,
          lastEmittedEpochBlockNum,
          totalTokensEmissionPerEpoch
        );
        if (options.save) {
          spinner.start("Saving data to CSV");
          CSV.fromJSON([protocolOwnerTableData.data]).save(
            headers,
            `protocol-owner-emissions-by-epoch-${lastEmittedEpochBlockNum}`,
            options.save
          );
        }
      } else if (isProvider) {
        providersTableData = await providerService.getProvidersWithDetails(
          address
        );
        spinner.stop();
        const headers = [
          "ID",
          "Name",
          "Basename",
          "Rank",
          "Token Emission (FOREST)",
          "Total Revenue ($)",
        ];

        providerService.showProvidersTableOutput(
          "Providers Emissions",
          headers,
          providersTableData,
          totalTokensEmissionPerEpoch,
          lastEmittedEpochBlockNum
        );
        if (options.save) {
          spinner.start("Saving data to CSV");
          CSV.fromJSON(providersTableData.data || []).save(
            headers,
            `providers-per-protocol-emissions-by-epoch-${lastEmittedEpochBlockNum}`,
            options.save
          );
        }
      } else if (isValidator) {
        validatorsTableData = await validatorService.getValidatorsWithDetails(
          address
        );
        spinner.stop();
        const headers = ["ID", "Name", "Rank", "Token Emission (FOREST)"];

        validatorService.showValidatorsTableData(
          "Validators Emissions",
          headers,
          validatorsTableData,
          lastEmittedEpochBlockNum,
          totalTokensEmissionPerEpoch
        );
        if (options.save) {
          spinner.start("Saving data to CSV");
          CSV.fromJSON(validatorsTableData.data || []).save(
            headers,
            `validators-emissions-by-epoch-${lastEmittedEpochBlockNum}`,
            options.save
          );
        }
      }
    }
  });
