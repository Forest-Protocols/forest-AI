import { checkValidationError } from "@/validation/error-handling";
import { z } from "zod";
import {
  addressSchema,
  DECIMALS,
  generateCID,
  Offer,
  OfferDetails,
  OfferDetailsSchema,
  OfferParam,
  PipeError,
  PipeMethod,
  PipeResponseCode,
  Protocol,
  Registry,
  Status,
  XMTPv3Pipe,
} from "@forest-protocols/sdk";
import { blue, green, magentaBright, red, yellow } from "ansis";
import {
  createXMTPPipe,
  createViemPublicClient,
  validateIfJSON,
  truncateAddress,
} from "@/utils";
import { Address, formatUnits } from "viem";
import { getCommand } from ".";
import { spinner } from "@/program";
import { createProtocolInstance, createRegistryInstance } from "@/client";
import { resolveToNames } from "@/utils/address";

type DetailedOffer = Offer & {
  ptAddress: Address;
  cid?: string;
  details?: string | OfferDetails;
};

const getOfferCommand = getCommand
  .command("offer")
  .aliases(["offers", "off"])
  .description("Lists the registered Offers")
  .argument("[addresses...]", "Lists Offers from the given Protocols")
  .option(
    "--details",
    "Reads additional details about the Offers from the Providers"
  )
  .option(
    "-c, --compact",
    "Limits the detail text outputs to 200 characters to save space in the screen"
  )
  .action(
    async (
      rawAddresses: string[],
      options: { details: boolean; compact: boolean }
    ) => {
      const addresses = checkValidationError(
        z.array(addressSchema).safeParse(rawAddresses)
      );
      const client = createViemPublicClient();
      const registry = createRegistryInstance(client);

      spinner.start("Reading Protocols");
      const pts: Protocol[] = [];

      if (addresses.length == 0) {
        pts.push(...(await registry.getAllProtocols()));
      } else {
        pts.push(
          ...addresses.map((address) => createProtocolInstance(client, address))
        );
      }

      spinner.text = "Reading registered Offers";
      const offerLists = pts.map((pt) =>
        getAllOffers(pt, registry, options.details)
      );

      let atLeastThereIsOneOffer = false;
      for await (const offerList of offerLists) {
        for (const offer of offerList) {
          await print(offer);

          // Place a new line
          spinner.stop();
          console.log();
          spinner.start();

          atLeastThereIsOneOffer = true;
        }
      }

      spinner.stop();

      if (!atLeastThereIsOneOffer) {
        console.error(yellow.bold("No offers has been found"));
      }
    }
  );

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

async function print(offer: DetailedOffer) {
  spinner.stop();
  const lines = [
    [
      blue("ID @ Protocol"),
      `${offer.id} @ ${await truncateAddress(offer.ptAddress)}`,
    ],
    [blue("Provider"), await truncateAddress(offer.ownerAddr)],
    [
      blue("Status"),
      offer.status == Status.Active
        ? green.bold("Active")
        : red.bold("Not Active"),
    ],
  ];

  if (offer.details) {
    if (typeof offer.details === "string") {
      // Make the detail text shorter if specified
      let detailText = offer.details;
      if (getOfferCommand.opts().compact) {
        detailText =
          detailText.substring(0, 200).trimEnd() +
          (offer.details.length > 200 ? "..." : "");
      }

      const linesOfText = detailText.split("\n");

      // Place spaces to each line
      for (let i = 0; i < linesOfText.length; i++) {
        linesOfText[i] = `  ${linesOfText[i]}`;
      }

      lines.push([yellow("Details"), `\n${linesOfText.join("\n")}`]);
    } else {
      lines.push([yellow("Name"), offer.details.name]);

      if (offer.details?.params) {
        const params = offer.details.params;
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
    }
  }

  lines.push(
    [green("Fee Per Second"), `${formatUnits(offer.fee, DECIMALS.USDC)} USDC`],
    [
      green("Fee Per Month"),
      `${formatUnits(offer.fee * 2635200n, DECIMALS.USDC)} USDC`,
    ],
    [magentaBright("Total Stock"), offer.stockAmount.toString()],
    [magentaBright("Active Agreements"), offer.activeAgreements.toString()],
    [red("CID"), offer.detailsLink]
  );

  for (const line of lines) {
    console.log(`${line[0]}:`, line[1]);
  }

  if (offer.details && offer.detailsLink != offer.cid) {
    console.error(
      yellow.bold(
        `\nWARNING: CID of the details file is different than the one committed on-chain.`
      )
    );
  }

  spinner.start();
}

async function getAllOffers(
  pt: Protocol,
  registry: Registry,
  fetchDetails?: any
) {
  const offerList: DetailedOffer[] = (await pt.getAllOffers()).map((offer) => ({
    ...offer,
    ptAddress: pt.address!,
  }));

  const resolver = resolveToNames(
    offerList.map((offer) => [offer.ownerAddr, offer.ptAddress]).flat()
  );

  if (fetchDetails) {
    const providerAddresses = [
      ...new Set(offerList.map((offer) => offer.ownerAddr)),
    ];

    const operatorOffers: Record<Address, DetailedOffer[]> = {};
    const providers = await Promise.all(
      providerAddresses.map((pa) => registry.getActor(pa))
    );

    // Unify offers by operators so we can make one request
    // per operator to retrieve all of the detail files.
    for (const offer of offerList) {
      const provider = providers.find(
        (prov) => prov!.ownerAddr == offer.ownerAddr
      )!;

      if (!operatorOffers[provider.operatorAddr]) {
        operatorOffers[provider.operatorAddr] = [];
      }
      operatorOffers[provider.operatorAddr].push(offer);
    }

    const operatorAddresses = Object.keys(operatorOffers) as Address[];
    const pipe = await createXMTPPipe();

    const detailRetrieveProcesses: Promise<(DetailedOffer | undefined)[]>[] =
      operatorAddresses.map((operatorAddress) =>
        getOffersDetails(pipe, operatorAddress, operatorOffers[operatorAddress])
      );

    for await (const detailedOffers of detailRetrieveProcesses) {
      for (const detailedOffer of detailedOffers) {
        if (!detailedOffer) continue;

        const index = offerList.findIndex(
          (offer) => offer.id == detailedOffer.id
        );
        if (index >= 0) {
          offerList[index] = detailedOffer;
        }
      }
    }
  }

  await resolver;
  return offerList;
}

async function getOffersDetails(
  pipe: XMTPv3Pipe,
  operator: Address,
  offers: DetailedOffer[]
) {
  try {
    const res = await pipe.send(operator, {
      method: PipeMethod.GET,
      path: "/details",
      timeout: 10 * 1000,
      body: offers.map((offer) => offer.detailsLink),
    });

    if (res.code != PipeResponseCode.OK) {
      throw new PipeError(res.code, res.body);
    }

    const detailFiles = res.body as string[];
    return await Promise.all(
      offers.map(async (offer) => {
        for (const detailFile of detailFiles) {
          const cid = await generateCID(detailFile);

          if (cid.toString() == offer.detailsLink) {
            let details: string | OfferDetails = detailFile;
            try {
              // TODO: Should we use this schema?

              // If the detail file is a JSON file and follows the OfferDetailSchema,
              // validate and use it.
              details = validateIfJSON(detailFile, OfferDetailsSchema, true);
            } catch {
              // Skip the validation and use the detail string as it is
            }

            return {
              ...offer,
              cid: cid.toString(),
              details,
            };
          }
        }
      })
    );
  } catch {
    spinner.fail(
      red(
        `Details of ${offers.length} Offers could not be retrieved from ${operator}`
      )
    );
  }

  return [];
}
