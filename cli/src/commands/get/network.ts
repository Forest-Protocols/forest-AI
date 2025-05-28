import { getCommand } from ".";
import { DECIMALS } from "@forest-protocols/sdk";
import { formatUnits } from "viem";
import { blue, red, green, cyanBright } from "ansis";
import { spinner } from "@/program";
import { createViemPublicClient, truncateAddress } from "@/utils";
import { createRegistryInstance } from "@/client";

getCommand
  .command("network")
  .alias("net")
  .description("Retrieves Network settings")
  .action(async () => {
    spinner.start("Reading blockchain data");

    const client = createViemPublicClient();
    const registry = createRegistryInstance(client);
    const registryInfo = await registry.getRegistryInfo();
    const lines = [
      [cyanBright("Registry Address"), await truncateAddress(registry.address)],
      [
        cyanBright("Treasury Address"),
        await truncateAddress(registryInfo.treasuryAddress),
      ],
      [
        cyanBright("Forest Token Address"),
        await truncateAddress(registryInfo.forestTokenAddress),
      ],
      [
        cyanBright("Forest Slasher Address"),
        await truncateAddress(registryInfo.slasherAddress),
      ],
      [
        cyanBright("USDC Address"),
        await truncateAddress(registryInfo.usdcAddress),
      ],
      [green("Burn Ratio"), `${registryInfo.burnRatio / 100n}%`],
      [green("Revenue Share"), `${registryInfo.revenueShare / 100n}%`],
      [blue("Max Protocol Count"), registryInfo.maxPCCount.toString()],
      [blue("Total Actors Count"), registryInfo.totalActorCount.toString()],
      [blue("Total Protocol Count"), registryInfo.totalPCCount.toString()],
      [
        blue("Total Providers Count"),
        registryInfo.totalProvidersCount.toString(),
      ],
      [
        blue("Total Validators Count"),
        registryInfo.totalValidatorsCount.toString(),
      ],
      [
        blue("Total Protocol Owners Count"),
        (
          registryInfo.totalActorCount -
          (registryInfo.totalProvidersCount + registryInfo.totalValidatorsCount)
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
          registryInfo.pcRegistrationFee,
          DECIMALS.FOREST
        )} FOREST`,
      ],
      [
        red("In Protocol Actor Registration Fee"),
        `${formatUnits(
          registryInfo.actorPCRegistrationFee,
          DECIMALS.FOREST
        )} FOREST`,
      ],
      [
        red("In Protocol Offer Registration Fee"),
        `${formatUnits(
          registryInfo.offerPCRegistrationFee,
          DECIMALS.FOREST
        )} FOREST`,
      ],
    ];

    spinner.stop();

    for (const line of lines) {
      console.log(`${line[0]}:`, line[1]);
    }
  });
