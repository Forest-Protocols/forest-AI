import { getCommand } from ".";
import { ActorType, DECIMALS } from "@forest-protocols/sdk";
import { formatUnits } from "viem";
import { blue, red, green, cyanBright } from "ansis";
import { spinner } from "@/program";
import { createViemPublicClient } from "@/utils";
import { createRegistryInstance, indexerClient } from "@/client";
import { formatAddress } from "@/utils/address";

getCommand
  .command("network")
  .alias("net")
  .description("Retrieves Network settings")
  .action(async () => {
    spinner.start("Reading blockchain data");

    const client = createViemPublicClient();
    const registry = createRegistryInstance(client);

    const [registryInfo, protocols, actors, providers, validators] =
      await Promise.all([
        indexerClient.getRegistryInfo(),
        indexerClient.getProtocols({ limit: 1 }), // We are only interested in the total count field so no need to fetch data
        indexerClient.getActors({ limit: 1 }), // We are only interested in the total count field so no need to fetch data
        indexerClient.getActors({ limit: 1, type: ActorType.Provider }), // We are only interested in the total count field so no need to fetch data
        indexerClient.getActors({ limit: 1, type: ActorType.Validator }), // We are only interested in the total count field so no need to fetch data
      ]);

    const lines = [
      [cyanBright("Registry Address"), formatAddress(registry.address)],
      [
        cyanBright("Treasury Address"),
        formatAddress(registryInfo.treasuryAddress),
      ],
      [
        cyanBright("Forest Token Address"),
        formatAddress(registryInfo.forestTokenAddress),
      ],
      [
        cyanBright("Forest Slasher Address"),
        formatAddress(registryInfo.slasherAddress),
      ],
      [cyanBright("USDC Address"), formatAddress(registryInfo.usdcAddress)],
      [green("Burn Ratio"), `${registryInfo.burnRatio / 100n}%`],
      [green("Revenue Share"), `${registryInfo.revenueShare / 100n}%`],
      [blue("Max Protocol Count"), registryInfo.maxProtocolCount.toString()],
      [blue("Total Actors Count"), actors.pagination.total.toString()],
      [blue("Total Protocol Count"), protocols.pagination.total.toString()],
      [blue("Total Providers Count"), providers.pagination.total.toString()],
      [blue("Total Validators Count"), validators.pagination.total.toString()],
      [
        blue("Total Protocol Owners Count"),
        (
          actors.pagination.total -
          (providers.pagination.total + validators.pagination.total)
        ).toString(),
      ],
      [
        red("Actor Registration Fee"),
        `${formatUnits(
          registryInfo.actorRegistrationFee,
          DECIMALS.FOREST
        )} FOREST`,
      ],
      [
        red("New Protocol Registration Fee"),
        `${formatUnits(
          registryInfo.protocolRegistrationFee,
          DECIMALS.FOREST
        )} FOREST`,
      ],
      [
        red("In Protocol Actor Registration Fee"),
        `${formatUnits(
          registryInfo.actorRegistrationFeeInProtocol,
          DECIMALS.FOREST
        )} FOREST`,
      ],
      [
        red("In Protocol Offer Registration Fee"),
        `${formatUnits(
          registryInfo.offerRegistrationFee,
          DECIMALS.FOREST
        )} FOREST`,
      ],
    ];

    spinner.stop();

    for (const line of lines) {
      console.log(`${line[0]}:`, line[1]);
    }
  });
