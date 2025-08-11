import { checkValidationError } from "@/validation/error-handling";
import { z } from "zod";
import {
  DECIMALS,
  IndexerOffer,
  OfferParam,
  Status,
} from "@forest-protocols/sdk";
import { blue, green, magentaBright, red, yellow } from "ansis";

import { Address, formatUnits } from "viem";
import { getCommand } from ".";
import { spinner } from "@/program";
import { indexerClient } from "@/client";
import { formatAddress, resolveENSName } from "@/utils/address";

type ExtendedOffer = IndexerOffer & {};
type OfferStatus = "active" | "inactive" | "all";

getCommand
  .command("offer")
  .aliases(["offers", "off"])
  .description("Lists the registered Offers")
  .argument("[addresses...]", "Lists Offers from the given Protocols")
  .option(
    "--details",
    "Reads additional details about the Offers from the Providers",
    true
  )
  .option(
    "--status <active | inactive | all>",
    "Filters Offers by status",
    "active"
  )
  .option(
    "-c, --compact",
    "Limits the detail text outputs to 200 characters to save space in the screen"
  )
  .action(
    async (
      rawAddresses: string[],
      options: { compact: boolean; status: OfferStatus }
    ) => {
      let addresses = checkValidationError(
        z.array(z.string()).safeParse(rawAddresses)
      );

      // Resolve addresses if they are ENS names
      addresses = await Promise.all(
        addresses.map((address) => resolveENSName(address))
      );

      spinner.start("Getting Offers");

      let offers: ExtendedOffer[] = [];
      if (addresses.length > 0) {
        for (const address of addresses) {
          offers.push(...(await getAllOffers(address, options.status)));
        }
      } else {
        // If no address is provided, get all Offers from all Protocols
        offers = await getAllOffers();
      }

      spinner.stop();
      console.log(`~ Found ${offers.length} Offer ~\n`);

      for (const offer of offers) {
        print(offer, options.compact);
        console.log("-".repeat(15));
        console.log();
      }

      if (offers.length === 0) {
        console.error(yellow.bold("No offers has been found"));
      }
    }
  );

async function getAllOffers(ptAddress?: string, status?: OfferStatus) {
  return await indexerClient
    .getOffers({
      limit: 100,
      protocolAddress: ptAddress?.toLowerCase() as Address,
      status: {
        active: Status.Active,
        inactive: Status.NotActive,
        all: undefined,
      }[status ?? "all"],
      autoPaginate: true,
    })
    .then((res) => res.data);
}

function parseOfferParamArray(params: OfferParam) {
  const parts: any[] = [];

  if (!Array.isArray(params)) {
    return "";
  }

  for (const param of params) {
    if (typeof param === "object") {
      parts.push(`${param.value} ${param.unit}`);
    } else {
      parts.push(param.toString());
    }
  }

  return parts.join(", ");
}

function print(offer: ExtendedOffer, compact?: boolean) {
  const lines = [
    [
      blue("ID @ Protocol"),
      `${offer.id} @ ${formatAddress(offer.protocolAddress)}`,
    ],
    // TODO: Add provider address to offer on the indexer response
    [blue("Provider ID"), offer.providerId],
    [
      blue("Status"),
      offer.status == Status.Active
        ? green.bold("Active")
        : red.bold("Not Active"),
    ],
  ];

  if (offer.rawDetails) {
    // Make the detail text shorter if specified
    let detailText = offer.rawDetails;
    if (compact) {
      detailText =
        detailText.substring(0, 200).trimEnd() +
        (offer.rawDetails.length > 200 ? "..." : "");
    }

    const linesOfText = detailText.split("\n");

    // Place spaces to each line
    for (let i = 0; i < linesOfText.length; i++) {
      linesOfText[i] = `  ${linesOfText[i]}`;
    }

    lines.push([yellow("Details"), `\n${linesOfText.join("\n")}`]);
  }

  if (offer.name) {
    lines.push([yellow("Name"), offer.name]);
  }

  if (offer.params) {
    const params = offer.params;
    const names = Object.keys(params);

    for (const name of names) {
      const param = params[name];
      if (Array.isArray(param)) {
        lines.push([yellow(name), parseOfferParamArray(param)]);
      } else if (typeof param === "object") {
        lines.push([yellow(name), `${param.value} ${param.unit}`]);
      } else {
        lines.push([yellow(name), param.toString()]);
      }
    }
  }

  const feePerSecond = BigInt(offer.fee);
  lines.push(
    [
      green("Fee Per Second"),
      `${formatUnits(feePerSecond, DECIMALS.USDC)} USDC`,
    ],
    [
      green("Fee Per Month"),
      `${formatUnits(feePerSecond * 2635200n, DECIMALS.USDC)} USDC`,
    ],
    [magentaBright("Total Stock"), offer.totalStock.toString()],
    // TODO: Active agreements info is missing from the indexer side
    // [magentaBright("Active Agreements"), offer.activeAgreementCount.toString()],
    [red("CID"), offer.detailsLink]
  );

  for (const line of lines) {
    console.log(`${line[0]}:`, line[1]);
  }

  // TODO: Indexer should provider a boolean value about whether the provided details are the ones that committed on chain
  // if (offer.details && offer.detailsLink != offer.cid) {
  //   console.error(
  //     yellow.bold(
  //       `\nWARNING: CID of the details file is different than the one committed on-chain.`
  //     )
  //   );
  // }
}
