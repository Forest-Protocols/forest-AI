import {
  addressSchema,
  DECIMALS,
  ForestPublicClientType,
  generateCID,
  PipeError,
  PipeMethod,
  PipeResponseCode,
  Protocol,
  ProtocolDetails,
  ProtocolDetailsSchema,
  ProtocolInfo,
  Registry,
  XMTPv3Pipe,
} from "@forest-protocols/sdk";
import { formatUnits } from "viem";
import { Address } from "viem";
import { blue, magentaBright, red, yellow } from "ansis";
import { getCommand } from ".";
import { z } from "zod";
import {
  createXMTPPipe,
  createViemPublicClient,
  truncateAddress,
  validateIfJSON,
} from "@/utils";
import { spinner } from "@/program";
import { checkValidationError } from "@/validation/error-handling";
import { createProtocolInstance, createRegistryInstance } from "@/client";
import { resolveToName } from "@/utils/address";

type PTWithInfo = {
  info: ProtocolInfo;
  client: Protocol;
  cid?: string;
  details?: ProtocolDetails | string;
  revenue?: bigint;
};
type ProtocolOptions = {
  details: boolean;
  compact: boolean;
};

const getPTCommand = getCommand
  .command("protocol")
  .aliases(["pt", "protocols"])
  .description("Shows the Protocols that have been registered in the Network")
  .argument(
    "[addresses...]",
    "Smart contract addresses of the Protocols. If not given shows all of them."
  )
  .option(
    "--details",
    "Reads additional details from the Providers/Validators in the Protocols"
  )
  .option(
    "-c, --compact",
    "Limits the detail text outputs to 200 characters to save space in the screen."
  )
  .action(async (rawAddresses: string[], options: ProtocolOptions) => {
    const addresses = checkValidationError(
      z.array(addressSchema).safeParse(rawAddresses)
    );

    const client = createViemPublicClient();
    const registry = createRegistryInstance(client);

    spinner.start("Reading blockchain data");
    let pts = await fetchProtocols(client, registry, addresses);

    if (options.details) {
      spinner.start(`Reading details from Actors in the Protocols`);
      const pipe = await createXMTPPipe();

      pts = await Promise.all(
        pts.map(async (pt) => {
          const res = await fetchDetails(pipe, pt);

          return {
            ...pt,
            details: res?.details,
            cid: res?.cid,
          };
        })
      );
    }

    spinner.stop();
    for (let i = 0; i < pts.length; i++) {
      await printProtocolInformation(pts[i]);

      if (i != pts.length - 1) {
        console.log("-".repeat(15));
      }
    }
  });

async function fetchProtocols(
  client: ForestPublicClientType,
  registry: Registry,
  addresses?: Address[]
) {
  let protocols: PTWithInfo[] = [];
  if (!addresses || addresses.length == 0) {
    const clients = await registry.getAllProtocols();
    protocols = await Promise.all(
      clients.map(async (protocol) => {
        const info = await protocol.getInfo();
        await Promise.all([
          resolveToName(info.ownerAddress),
          resolveToName(info.contractAddress),
        ]);
        return {
          client: protocol,
          info,
          revenue: await protocol.getAgreementsValue(),
        };
      })
    );
  } else {
    const infos = await Promise.all(
      addresses.map(async (address) => {
        const info = await registry.getProtocolInfo(address);
        if (!info) {
          spinner.fail(
            red(`Protocol ${await truncateAddress(address)} not found`)
          );
          spinner.start();
          return;
        }

        await Promise.all([
          resolveToName(info.ownerAddress),
          resolveToName(info.contractAddress),
        ]);
        const protocol = createProtocolInstance(client, address);
        return {
          client: protocol,
          info,
          revenue: await protocol.getAgreementsValue(),
        };
      })
    );

    for (const info of infos) {
      if (!info) {
        continue;
      }
      protocols.push(info);
    }
  }

  return protocols;
}

async function fetchDetails(pipe: XMTPv3Pipe, pt: PTWithInfo) {
  try {
    const providers = await pt.client.getAllProviders();

    if (providers.length == 0) {
      spinner.warn(
        yellow(
          `Protocol ${await truncateAddress(
            pt.client.address!
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
          body: [pt.info.detailsLink],
        });

        if (res.code != PipeResponseCode.OK) {
          throw new PipeError(res.code, res.body);
        }

        const [detailFile] = res.body;

        return {
          cid: (await generateCID(detailFile)).toString(),

          details: validateIfJSON(
            detailFile,
            // TODO: Validate with that schema?
            ProtocolDetailsSchema,
            true
          ),
        };
      } catch {
        // TODO: Implement better warning message
        /*   spinner.fail(
          red(
            `Protocol (${await truncateAddress(
              pt.client.address!
            )}) details could not be retrieved from ${await truncateAddress(
              operatorAddress
            )}${i != operatorAddresses.length - 1 ? ", trying next one" : ""}`
          )
        );
        spinner.start(); */
      }
    }
  } catch {
    // TODO: Implement better warning message
    /*     spinner.fail(
      red(
        `Protocol (${await truncateAddress(
          pt.client.address!
        )}) details could not be retrieved`
      )
    );
    spinner.start(); */
  }
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

async function printProtocolInformation(pt: PTWithInfo) {
  const lines: any[][] = [
    [blue("Protocol Address"), await truncateAddress(pt.client.address!)],
    [blue("Owner Address"), await truncateAddress(pt.info.ownerAddress)],
    [
      blue("Term Update Delay"),
      `${pt.info.termUpdateDelay} Blocks (~ ${blockCountToTime(
        pt.info.termUpdateDelay
      )})`,
    ],
    [
      blue("Agreement Count"),
      pt.info.agreementCount <= 0n
        ? "Not registered yet"
        : pt.info.agreementCount.toString(),
    ],
    [blue("Registered Actor Count")],
    [blue("  Provider  "), pt.info.providerIds.length || "Not Registered Yet"],
    [blue("  Validator "), pt.info.validatorIds.length || "Not Registered Yet"],
  ];

  if (pt.details) {
    if (typeof pt.details === "string") {
      // Make the detail text shorter if specified
      let detailText = pt.details;
      if (getPTCommand.opts().compact) {
        detailText =
          detailText.substring(0, 200).trimEnd() +
          (pt.details.length > 200 ? "..." : "");
      }

      const linesOfText = detailText.split("\n");

      // Place spaces to each line
      for (let i = 0; i < linesOfText.length; i++) {
        linesOfText[i] = `  ${linesOfText[i]}`;
      }

      lines.push([magentaBright("Details"), `\n${linesOfText.join("\n")}`]);
    } else {
      lines.push([magentaBright("Name"), pt.details.name]);

      if (pt.details.softwareStack) {
        lines.push([magentaBright("Software Stack"), pt.details.softwareStack]);
      }
      if (pt.details.version) {
        lines.push([magentaBright("Version"), pt.details.version]);
      }

      // TODO: Print offer params
    }
  }

  lines.push([
    yellow("Monthly Revenue"),
    `$${formatUnits((pt?.revenue || 0n) * 2635200n, DECIMALS.USDC)}`,
  ]);
  lines.push(
    [yellow("Registration Fees")],
    [
      yellow("  Provider  "),
      `${formatUnits(
        pt.info.registrationFees.provider,
        DECIMALS.FOREST
      )} FOREST`,
    ],
    [
      yellow("  Validator "),
      `${formatUnits(
        pt.info.registrationFees.validator,
        DECIMALS.FOREST
      )} FOREST`,
    ],
    [
      yellow("  Offer     "),
      `${formatUnits(pt.info.registrationFees.offer, DECIMALS.FOREST)} FOREST`,
    ],

    [yellow("Emission Shares"), undefined],
    [yellow("  Provider  "), `${pt.info.emissionShares.provider / 100}%`],
    [yellow("  Validator "), `${pt.info.emissionShares.validator / 100}%`],
    [yellow("  PT Owner  "), `${pt.info.emissionShares.pcOwner / 100}%`],

    [yellow("Maximum Actor Count"), undefined],
    [yellow("  Provider  "), `${pt.info.maxActorCount.provider}`],
    [yellow("  Validator "), `${pt.info.maxActorCount.validator}`],
    [
      yellow("Min. Collateral Amount"),
      `${formatUnits(pt.info.minCollateral, DECIMALS.FOREST)} FOREST`,
    ],
    [red("CID"), pt.info.detailsLink]
  );

  for (const line of lines) {
    if (line[1] === undefined) {
      console.log(`${line[0]}:`);
      continue;
    }
    console.log(`${line[0]}:`, line[1]);
  }

  if (pt.details && pt.cid != pt.info.detailsLink) {
    console.error(
      yellow.bold(
        `\nWARNING: CID of the details file is different than the one committed on-chain.`
      )
    );
  }
}
