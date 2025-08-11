import { indexerClient } from "@/client";
import { spinner } from "@/program";
import { formatAddress, resolveENSName, resolveToName } from "@/utils/address";
import { checkValidationError } from "@/validation/error-handling";
import {
  ActorType,
  actorTypeToString,
  AddressSchema,
  IndexerActor,
  MaybePromise,
  statusToString,
} from "@forest-protocols/sdk";
import { blue, green, magenta, yellow } from "ansis";
import { Command } from "commander";
import { DateTime } from "luxon";
import { z } from "zod";

export type ExtendedActor = IndexerActor & {
  additionalLogs?: MaybePromise<string | undefined>;
  ensOwnerAddress?: Promise<string | undefined>;
  ensOperatorAddress?: Promise<string | undefined>;
  ensBillingAddress?: Promise<string | undefined>;
};

export async function createGetActorCommand(
  parent: Command,
  params: {
    command: string;
    aliases: string[];
    actorType: ActorType;
    additionalLogs: (actor: ExtendedActor) => MaybePromise<string>;
  }
) {
  const actorType = actorTypeToString(params.actorType);

  return parent
    .command(params.command)
    .aliases(params.aliases)
    .description(`Gets one or more ${actorType}(s) information`)
    .argument(
      "[address or id...]",
      `Owner wallet address or IDs of the ${actorType}s`
    )
    .allowUnknownOption(true) // To make it backward compatible since `-d` is not supported anymore
    .action(
      async (rawAddresses: string[], rawOptions: { details: boolean }) => {
        const options = checkValidationError(
          z
            .object({
              addresses: z.array(z.string()).default([]),
              details: z.boolean().default(false),
            })
            .safeParse({ ...rawOptions, addresses: rawAddresses })
        );
        spinner.start("Fetching data from the Indexer");
        let actors: ExtendedActor[] = [];

        if (options.addresses.length === 0) {
          actors = await indexerClient
            .getActors({
              limit: 100,
              type: params.actorType,
              autoPaginate: true,
            })
            .then((res) =>
              res.data.map((actor) => ({
                ...actor,
                // Queue the ENS name resolution and additional log generation for each Actor
                additionalLogs: params.additionalLogs?.(actor),
                ensOwnerAddress: resolveToName(actor.ownerAddress),
                ensOperatorAddress: resolveToName(actor.operatorAddress),
                ensBillingAddress: resolveToName(actor.billingAddress),
              }))
            );
        } else {
          // Process each of the given addresses
          actors = await Promise.all(
            options.addresses.map(async (address) => {
              const isAddressValidation = AddressSchema.safeParse(address);
              const id = parseInt(address);
              let actor: ExtendedActor;

              if (isAddressValidation.success) {
                // The given "thing" is an address
                actor = await indexerClient.getActorByIdOrAddress(
                  isAddressValidation.data
                );
              } else if (!isNaN(id)) {
                // The given "thing" is an ID
                actor = await indexerClient.getActorByIdOrAddress(id);
              } else {
                // The given "thing" is an ENS name, resolve it to an address
                actor = await indexerClient.getActorByIdOrAddress(
                  await resolveENSName(address)
                );
              }

              // If the implementation wants to log more information,
              // call that function to generate those logs and store them in the Actor
              actor.additionalLogs = await params.additionalLogs?.(actor);
              actor.ensOwnerAddress = resolveToName(actor.ownerAddress);
              actor.ensOperatorAddress = resolveToName(actor.operatorAddress);
              actor.ensBillingAddress = resolveToName(actor.billingAddress);

              return actor;
            })
          );
        }

        // Wait until all the async calls are resolved
        spinner.text = "Resolving ENS names";
        await Promise.all(
          actors.map((actor) =>
            Promise.all([
              actor.additionalLogs,
              actor.ensOwnerAddress,
              actor.ensOperatorAddress,
              actor.ensBillingAddress,
            ])
          )
        );

        // Print them out
        spinner.stop();
        for (const actor of actors) {
          await printActorInformation(actor);
          console.log("-".repeat(15));
          console.log();
        }
      }
    );
}

/**
 * Common additional logs function for Provider and Validator Actors
 */
export async function providerAndValidatorAdditionalLogs(actor: ExtendedActor) {
  let output = "";
  if (actor.registeredProtocols.length > 0) {
    output += "\nRegistered in the following Protocols:\n";
    output += magenta.bold(
      (
        await Promise.all(
          actor.registeredProtocols.map(async (protocol) => {
            // Resolve each of the registered Protocol addresses to ENS names if possible
            const ensName = await resolveToName(protocol.address);

            if (protocol.name) {
              return `${protocol.name} (${
                ensName ? `${ensName}, ` : ""
              }${formatAddress(protocol.address)})`;
            }
            return protocol.address;
          })
        )
      ).join(", ")
    );
  }
  return output;
}

async function printActorInformation(actor: ExtendedActor) {
  const lines: [string, any][] = [];

  lines.push([blue("ID"), actor.id]);

  if (actor.name) {
    lines.push([blue("Name"), actor.name]);
  }

  lines.push([blue("Type"), actorTypeToString(actor.type)]);
  lines.push([blue("Status"), statusToString(actor.status)]);

  if (actor.homepage) {
    lines.push([blue("Homepage"), actor.homepage]);
  }
  if (actor.description) {
    lines.push([blue("Description"), actor.description]);
  }

  const ensOwnerAddress = await actor.ensOwnerAddress;
  const ensBillingAddress = await actor.ensBillingAddress;
  const ensOperatorAddress = await actor.ensOperatorAddress;

  // Include the ENS names if they are available alongside the addresses
  lines.push([
    yellow("Owner Address"),
    ensOwnerAddress
      ? `${ensOwnerAddress} (${formatAddress(actor.ownerAddress)})`
      : formatAddress(actor.ownerAddress),
  ]);
  lines.push([
    yellow("Billing Address"),
    ensBillingAddress
      ? `${ensBillingAddress} (${formatAddress(actor.billingAddress)})`
      : formatAddress(actor.billingAddress),
  ]);
  lines.push([
    yellow("Operator Address"),
    ensOperatorAddress
      ? `${ensOperatorAddress} (${formatAddress(actor.operatorAddress)})`
      : formatAddress(actor.operatorAddress),
  ]);

  lines.push([
    green("Registered at (Network level)"),
    DateTime.fromJSDate(new Date(actor.registeredAt)).toFormat("DD"),
  ]);

  lines.push([green.bold("CID"), actor.detailsLink]);

  for (const [key, value] of lines) {
    if (value === undefined) {
      console.log(key);
    } else {
      console.log(`${key}:`, value);
    }
  }

  const additionalLogs = await actor.additionalLogs;
  if (additionalLogs) {
    console.log(additionalLogs);
  }

  // TODO: Indexer should include a field that indicates whether the indexed details and CID that are committed on-chain are the same.
  // if (actor.details && actor.details.cid != actor.detailsLink) {
  //   console.error(
  //     yellow.bold(
  //       `\nWARNING: CID of the details file is different than the one committed on-chain.`
  //     )
  //   );
  // }
}
