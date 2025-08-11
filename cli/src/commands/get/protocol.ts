import {
  ActorType,
  DECIMALS,
  IndexerProtocol,
  IndexerProtocolActor,
  IndexerProtocolOfferParam,
} from "@forest-protocols/sdk";
import { formatUnits } from "viem";
import { Address } from "viem";
import { blue, cyan, green, magentaBright, red, yellow } from "ansis";
import { getCommand } from ".";
import { z } from "zod";
import { spinner } from "@/program";
import { checkValidationError } from "@/validation/error-handling";
import { formatAddress, resolveENSName, resolveToName } from "@/utils/address";
import { indexerClient } from "@/client";

type ExtendedProtocol = IndexerProtocol & {
  actors: (IndexerProtocolActor & {
    ensAddress?: Promise<string | undefined>;
  })[];
  offerParams?: IndexerProtocolOfferParam[];
  ensAddress?: Promise<string | undefined>;
  ensOwnerAddress?: Promise<string | undefined>;
};

getCommand
  .command("protocol")
  .aliases(["pt", "protocols"])
  .description("Shows the Protocols that have been registered in the Network")
  .argument(
    "[addresses...]",
    "Smart contract addresses of the Protocols. If not given shows all of them."
  )
  .option(
    "-d, --details",
    "Reads additional details from the Providers/Validators in the Protocols",
    true
  )
  .option(
    "-c, --compact",
    "Limits the detail text outputs to 200 characters to save space in the screen."
  )
  .action(
    async (
      rawAddresses: string[],
      options: { details: boolean; compact: boolean }
    ) => {
      let addresses = checkValidationError(
        z.array(z.string()).safeParse(rawAddresses)
      );

      spinner.start();

      if (addresses.length > 0) {
        // Resolve arguments from ENS names to addresses if they are not plain addresses
        addresses = await Promise.all(
          addresses.map((address) => resolveENSName(address))
        );
      }

      spinner.text = "Fetching Protocols from the Indexer";

      let protocols: ExtendedProtocol[] = [];

      if (addresses.length === 0) {
        protocols = await indexerClient
          .getProtocols({
            limit: 100,
            autoPaginate: true,
          })
          .then((res) => compileAndFetchProtocolData(res.data));
      } else {
        protocols = await compileAndFetchProtocolData(addresses as Address[]);
      }

      // Wait until all ENS names are resolved
      spinner.text = "Resolving ENS names";
      await Promise.all(
        protocols.map(async (pt) => {
          await pt.ensAddress;
          await pt.ensOwnerAddress;
          await Promise.all(pt.actors.map((actor) => actor.ensAddress));
        })
      );

      spinner.stop();
      for (const pt of protocols) {
        await printProtocolInformation(pt, options);
        console.log("-".repeat(15));
        console.log();
      }
    }
  );

async function compileAndFetchProtocolData(
  addresses: (Address | IndexerProtocol)[]
) {
  return Promise.all(
    addresses.map(async (addrOrPt) => ({
      ...(typeof addrOrPt === "string"
        ? await indexerClient.getProtocolByAddress(addrOrPt)
        : addrOrPt),
      ensAddress:
        typeof addrOrPt === "string"
          ? resolveToName(addrOrPt)
          : resolveToName(addrOrPt.address),
      actors: (
        await indexerClient.getProtocolActors(
          typeof addrOrPt === "string" ? addrOrPt : addrOrPt.address
        )
      ).map((actor) => ({
        ...actor,
        ensAddress: resolveToName(actor.operatorAddress),
      })),
      offerParams: await indexerClient.getProtocolOfferParams(
        typeof addrOrPt === "string" ? addrOrPt : addrOrPt.address
      ),
    }))
  );
}

function blockCountToTime(blockCount: bigint) {
  const totalSeconds = Number(blockCount / 2n);

  if (totalSeconds >= 86400) {
    const days = Math.floor(totalSeconds / 86400);
    return days + (days === 1 ? " day" : " days");
  }
  // Otherwise, if there are at least 3600 seconds, show hours only.
  else if (totalSeconds >= 3600) {
    const hours = Math.floor(totalSeconds / 3600);
    return hours + (hours === 1 ? " hour" : " hours");
  }
  // Otherwise, if there are at least 60 seconds, show minutes only.
  else if (totalSeconds >= 60) {
    const minutes = Math.floor(totalSeconds / 60);
    return minutes + (minutes === 1 ? " minute" : " minutes");
  }
  // Otherwise, show seconds.
  else {
    return totalSeconds + (totalSeconds === 1 ? " second" : " seconds");
  }
}

async function printProtocolInformation(
  pt: ExtendedProtocol,
  { compact }: { compact: boolean }
) {
  const ensProtocolAddress = await pt.ensAddress;
  const ensOwnerAddress = await pt.ensOwnerAddress;

  const lines: any[][] = [
    [red("CID"), pt.detailsLink],
    [
      blue("Protocol Address"),
      ensProtocolAddress
        ? `${ensProtocolAddress} (${formatAddress(pt.address)})`
        : formatAddress(pt.address),
    ],
    [
      blue("Owner Address"),
      ensOwnerAddress
        ? `${ensOwnerAddress} (${formatAddress(pt.ownerAddress)})`
        : formatAddress(pt.ownerAddress),
    ],
    [
      blue("Term Update Delay"),
      `${pt.termUpdateDelay} Blocks (~ ${blockCountToTime(
        BigInt(pt.termUpdateDelay)
      )})`,
    ],
    [blue("Total Agreement Count"), pt.totalAgreementCount.toString()],
    [blue("Active Agreement Count"), pt.activeAgreementCount.toString()],
    [blue("Registered Actor Count")],
    [
      blue("  Provider  "),
      pt.actors?.filter((a) => a.actorType === 1).length ||
        "Not Registered Yet",
    ],
    [
      blue("  Validator "),
      pt.actors?.filter((a) => a.actorType === 2).length ||
        "Not Registered Yet",
    ],
  ];

  if (pt.rawDetails) {
    // Shorten the raw details if specified
    let detailText = pt.rawDetails;
    if (compact) {
      detailText =
        detailText.substring(0, 200).trimEnd() +
        (pt.rawDetails.length > 200 ? "..." : "");
    }

    const linesOfText = detailText.split("\n");

    // Indent each line
    for (let i = 0; i < linesOfText.length; i++) {
      linesOfText[i] = `  ${linesOfText[i]}`;
    }

    lines.push([magentaBright("Details"), `\n${linesOfText.join("\n")}`]);
  }

  if (pt.description) {
    lines.push([magentaBright("Description"), pt.description]);
  }

  if (pt.name) {
    lines.push([magentaBright("Name"), pt.name]);
  }

  if (pt.softwareStack) {
    lines.push([magentaBright("Software Stack"), pt.softwareStack]);
  }

  if (pt.version) {
    lines.push([magentaBright("Version"), pt.version]);
  }

  lines.push([
    yellow("Monthly Revenue"),
    `$${formatUnits(BigInt(pt.monthlyRevenue), DECIMALS.USDC)}`,
  ]);
  lines.push(
    [yellow("Registration Fees")],
    [
      yellow("  Provider  "),
      `${formatUnits(
        BigInt(pt.providerRegistrationFee),
        DECIMALS.FOREST
      )} FOREST`,
    ],
    [
      yellow("  Validator "),
      `${formatUnits(
        BigInt(pt.validatorRegistrationFee),
        DECIMALS.FOREST
      )} FOREST`,
    ],
    [
      yellow("  Offer     "),
      `${formatUnits(BigInt(pt.offerRegistrationFee), DECIMALS.FOREST)} FOREST`,
    ],

    [yellow("Emission Shares"), undefined],
    [yellow("  Provider  "), `${pt.providerEmissionShare / 100}%`],
    [yellow("  Validator "), `${pt.validatorEmissionShare / 100}%`],
    [yellow("  PT Owner  "), `${pt.ptOwnerEmissionShare / 100}%`],

    [yellow("Maximum Actor Count"), undefined],
    [yellow("  Provider  "), `${pt.maxProviderCount}`],
    [yellow("  Validator "), `${pt.maxValidatorCount}`],
    [
      yellow("Min. Collateral Amount"),
      `${formatUnits(BigInt(pt.minCollateral), DECIMALS.FOREST)} FOREST`,
    ]
  );

  for (const line of lines) {
    if (line[1] === undefined) {
      console.log(`${line[0]}:`);
      continue;
    }
    console.log(`${line[0]}:`, line[1]);
  }

  // Print offer parameters if available
  if (pt.offerParams && pt.offerParams.length > 0) {
    console.log(yellow("Offer Parameters:"));
    for (const param of pt.offerParams) {
      console.log(
        `  ${green(param.name)}: ${param.unit} (Priority: ${param.priority})`
      );
    }
  }

  // Print registered Actors
  if (pt.actors.length > 0) {
    console.log(yellow("Registered Actors:"));
    for (const actor of pt.actors) {
      // Since registered actors array also includes the Protocol Owner, we need to skip it.
      if (actor.actorType === ActorType.ProtocolOwner) continue;

      const actorType = cyan(actor.actorType === 1 ? "Provider" : "Validator");
      const ensAddress = await actor.ensAddress;

      console.log(
        `  ${actorType}: ${
          ensAddress
            ? `${ensAddress} (${formatAddress(actor.ownerAddress)})`
            : formatAddress(actor.ownerAddress)
        } (Collateral: ${formatUnits(
          BigInt(actor.collateral),
          DECIMALS.FOREST
        )} FOREST)`
      );
    }
  }
}
