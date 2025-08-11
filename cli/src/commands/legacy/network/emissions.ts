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
  GranularScoresTableData,
} from "../../network/types";
import { providerService } from "@/commands/legacy/services/entities/provider.service";
import { protocolService } from "@/commands/legacy/services/entities/protocol.service";
import { tokenomicsService } from "@/commands/legacy/services/network/tokenomics.service";
import { CSV } from "@/commands/legacy/utils/csv";
import { actorService } from "@/commands/legacy/services/entities/base-actor-service";
import { boolean } from "zod";
import { validatorService } from "@/commands/legacy/services/entities/validator.service";
import { protocolOwnerService } from "@/commands/legacy/services/entities/pto-service";
import { z } from "zod";

networkCommand
  .command("emissions")
  .description("Shows of the emissions of the Network")
  .option(
    "--protocol <ptAddress>",
    "Show all emissions for protocol owners, providers and validators of a specific protocol"
  )
  .option(
    "--providers",
    "Show all emissions for providers of a specific protocol (required to call --protocol with <ptAddress>)"
  )
  .option(
    "--validators",
    "Show all emissions for validators of a specific protocol (required to call --protocol with <ptAddress>)"
  )
  .option(
    "--pto",
    "Show all emissions for pto of a specific protocol (required to call --protocol with <ptAddress>)"
  )
  .option("--save <output>", "Save the emissions to a file")
  .option(
    "--granular-data <actorAddressOrId>",
    "Show granular validation details for a specific actor in a protocol (required to call --protocol with <ptAddress>)"
  )
  .action(async (options: EmissionsOptions) => {
    const ptAddress = checkValidationError(
      addressSchema.optional().safeParse(options.protocol)
    );
    const isProviders = checkValidationError(
      boolean().optional().safeParse(options.providers)
    );
    const isValidators = checkValidationError(
      boolean().optional().safeParse(options.validators)
    );
    const isProtocolOwner = checkValidationError(
      boolean().optional().safeParse(options.pto)
    );
    const actorAddressOrId = checkValidationError(
      z
        .union([addressSchema, z.coerce.number().int().positive()])
        .optional()
        .safeParse(options.granularData)
    );

    if (!ptAddress && (isProviders || isValidators || isProtocolOwner)) {
      throw new Error(
        "Error: --providers, --validators, and --pto options require --protocol <ptAddress> to be specified."
      );
    }

    if (actorAddressOrId && !ptAddress) {
      throw new Error(
        "Error: --granular-data <actorAddressOrId> option requires --protocol <ptAddress> to be specified."
      );
    }

    if (actorAddressOrId && (isProviders || isValidators || isProtocolOwner)) {
      throw new Error(
        "Error: --granular-data <actorAddressOrId> option cannot be used with --providers, --validators, or --pto options."
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
    let actorData: GranularScoresTableData | null = null;

    if (!ptAddress && !isProviders && !isValidators && !isProtocolOwner) {
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
    if (ptAddress) {
      if (
        !isProviders &&
        !isValidators &&
        !isProtocolOwner &&
        !actorAddressOrId
      ) {
        actorsTableData = await actorService.getActorsWithDetails(ptAddress);
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
      if (actorAddressOrId) {
        actorData = await actorService.getActorWithGranularScores(
          actorAddressOrId,
          ptAddress,
          lastEmittedEpochBlockNum
        );
        spinner.stop();
        const headers = [
          "Agreement ID",
          actorData.isProvider ? "Validator ID" : "Provider ID",
          "Tx Hash",
          "Details CID",
          "Score",
        ];

        actorService.showGranularScoresTableData(
          actorData.isProvider
            ? "Provider Granular Scores"
            : "Validator Test Sessions",
          headers,
          actorData,
          lastEmittedEpochBlockNum,
          totalTokensEmissionPerEpoch
        );
      }
      if (isProtocolOwner) {
        protocolOwnerTableData =
          await protocolOwnerService.getProtocolOwnerWithDetails(ptAddress);
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
      } else if (isProviders) {
        providersTableData = await providerService.getProvidersWithDetails(
          ptAddress
        );
        spinner.stop();
        const headers = [
          "ID",
          "Name",
          "Basename or Address",
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
      } else if (isValidators) {
        validatorsTableData = await validatorService.getValidatorsWithDetails(
          ptAddress
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
