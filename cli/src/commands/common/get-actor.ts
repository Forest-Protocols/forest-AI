import { createRegistryInstance } from "@/client";
import { spinner } from "@/program";
import { createViemPublicClient, createXMTPPipe } from "@/utils";
import {
  formatAddress,
  resolveToAddress,
  resolveToName,
} from "@/utils/address";
import { checkValidationError } from "@/validation/error-handling";
import {
  Actor,
  ActorDetails,
  ActorDetailsSchema,
  ActorType,
  actorTypeToString,
  AddressSchema,
  generateCID,
  MaybePromise,
  PipeError,
  PipeMethod,
  PipeResponseCode,
  Registry,
  statusToString,
  tryReadJson,
  XMTPv3Pipe,
} from "@forest-protocols/sdk";
import { blue, green, red, yellow } from "ansis";
import { Command } from "commander";
import dayjs from "dayjs";
import { Address } from "viem";
import { z } from "zod";

export type ActorWithDetails = Actor & {
  details?: ActorDetails & { cid: string };
  ensOwnerAddress?: Promise<string | undefined>;
  ensOperatorAddress?: Promise<string | undefined>;
  ensBillingAddress?: Promise<string | undefined>;
};
export type FetchAllActorsHandler = (registry: Registry) => Promise<Actor[]>;
export type FetchMoreActorInfoHandler<
  T extends Record<string, any> = Record<string, any>
> = (
  registry: Registry,
  actor: ActorWithDetails
) => Promise<ActorWithDetails & T>;
export type PrintHandler<T> = (
  actor: ActorWithDetails & T
) => MaybePromise<void>;
export type WhereToFetchDetailsFromHandler<T> = (
  registry: Registry,
  pipe: XMTPv3Pipe,
  actor: ActorWithDetails & T
) => MaybePromise<Address>;

export async function createGetActorCommand<
  T extends Record<string, any> = Record<string, any>
>(
  parent: Command,
  params: {
    command: string;
    aliases: string[];
    actorType: ActorType;

    fetchAllActors: FetchAllActorsHandler;
    fetchMoreActorInfo?: FetchMoreActorInfoHandler<T>;
    whereToFetchDetailsFrom?: WhereToFetchDetailsFromHandler<T>;
    printHandler?: PrintHandler<T>;
  }
) {
  const actorType = actorTypeToString(params.actorType);

  return parent
    .command(params.command)
    .aliases(params.aliases)
    .description(`Gets one or more ${actorType} information`)
    .argument("[addresses...]", `Owner wallet address of the ${actorType}s`)
    .option(
      "--details, -d",
      `Reads additional details over XMTP from the ${actorType}`
    )
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
        const client = createViemPublicClient();
        const registry = createRegistryInstance(client);

        spinner.start("Fetching data from blockchain");

        // Fetch the Actors
        let actors: ActorWithDetails[];
        if (options.addresses.length === 0) {
          actors = await params.fetchAllActors(registry);
        } else {
          actors = await getActorsByAddresses(
            registry,
            actorType,
            await resolveAddresses(options.addresses)
          );
        }

        // If the function is provided, call it on each
        // Actor to fetch more information
        if (params.fetchMoreActorInfo) {
          actors = await Promise.all(
            actors.map((actor) => params.fetchMoreActorInfo!(registry, actor))
          );
        }

        // Make ENS resolution calls
        actors = actors.map((actor) => ({
          ...actor,
          ensOwnerAddress: resolveToName(actor.ownerAddr),
          ensOperatorAddress: resolveToName(actor.operatorAddr),
          ensBillingAddress: resolveToName(actor.billingAddr),
        }));

        // Fetch the details if the option is provided
        if (options.details) {
          spinner.start(`Fetching details from ${actorType}s`);
          const pipe = await createXMTPPipe();
          actors = await Promise.all(
            actors.map(async (actor) => ({
              ...actor,
              details: await fetchDetails(
                registry,
                pipe,
                actor,
                params.whereToFetchDetailsFrom
              ),
            }))
          );
        }

        // Wait until the ENS names are resolved
        spinner.text = "Resolving ENS names";
        await Promise.all(
          actors.map(async (actor) => {
            await actor.ensOwnerAddress;
            await actor.ensOperatorAddress;
            await actor.ensBillingAddress;
          })
        );

        // Print them out
        spinner.stop();
        for (const actor of actors) {
          await printActorInformation(
            options.details,
            actor as ActorWithDetails & T,
            params.printHandler
          );
          console.log("-".repeat(15));
        }
      }
    );
}

/**
 * Checks and resolves the given addresses if they are ENS names
 */
async function resolveAddresses(addresses: string[]) {
  const addressResolutions: Promise<Address | undefined>[] = [];
  for (const addr of addresses) {
    if (addr.includes(".")) {
      addressResolutions.push(resolveToAddress(addr));
    } else {
      const validation = AddressSchema.safeParse(addr);
      if (validation.error) {
        throw new Error(`Invalid address: ${addr}`);
      }
      addressResolutions.push(Promise.resolve(validation.data));
    }
  }

  const resolvedAddresses = await Promise.all(addressResolutions);
  return resolvedAddresses.filter((addr) => addr !== undefined);
}

/**
 * Fetches all the actors and checks their existence in the Network
 */
async function getActorsByAddresses(
  registry: Registry,
  actorType: string,
  addresses: Address[]
) {
  const actors: Actor[] = [];
  const fetchActorResults = await Promise.all(
    addresses.map(async (address) => ({
      address,
      actor: await registry.getActor(address),
    }))
  );

  for (const result of fetchActorResults) {
    if (result.actor === undefined) {
      spinner.fail(
        red(
          `${actorType} ${formatAddress(
            result.address
          )} is not registered in the Network`
        )
      );
      spinner.start();
    } else {
      actors.push(result.actor);
    }
  }

  return actors;
}

/**
 * Fetches the details from Actor over XMTP
 */
async function fetchDetails<T>(
  registry: Registry,
  pipe: XMTPv3Pipe,
  actor: Actor,
  handler?: WhereToFetchDetailsFromHandler<T>
) {
  try {
    let operatorAddress = actor.operatorAddr;

    if (handler) {
      operatorAddress = await handler(
        registry,
        pipe,
        actor as ActorWithDetails & T
      );
    }

    const res = await pipe.send(operatorAddress, {
      method: PipeMethod.GET,
      path: "/details",
      timeout: 10 * 1000,
      body: [actor.detailsLink],
    });

    if (res.code != PipeResponseCode.OK) {
      throw new PipeError(res.code, res.body);
    }

    const [detailFileContent] = res.body;
    const validation = ActorDetailsSchema.safeParse(
      tryReadJson(detailFileContent)
    );

    if (validation.error) {
      // const actorType = actorTypeToString(actor.actorType);
      // spinner.warn(
      //   yellow(
      //     `Details of ${actorType} ${formatAddress(
      //       actor.ownerAddr
      //     )} is not in a valid format`
      //   )
      // );
      // spinner.start();
      return;
    }

    return {
      ...validation.data,
      cid: (await generateCID(detailFileContent)).toString(),
    };
  } catch {
    // spinner.fail(red(``));
    // spinner.start();
  }
}

async function printActorInformation<T extends Record<string, any>>(
  detailsOption: boolean,
  actor: ActorWithDetails & T,
  handler?: PrintHandler<T>
) {
  const lines: [string, any][] = [];

  if (detailsOption && actor.details === undefined) {
    lines.push([
      yellow.bold("WARNING: Details couldn't be fetched"),
      undefined,
    ]);
  }

  lines.push([blue("ID"), actor.id]);

  if (actor.details?.name) {
    lines.push([blue("Name"), actor.details?.name]);
  }

  lines.push([blue("Type"), actorTypeToString(actor.actorType)]);
  lines.push([blue("Status"), statusToString(actor.status)]);

  if (actor.details?.homepage) {
    lines.push([blue("Homepage"), actor.details.homepage]);
  }
  if (actor.details?.description) {
    lines.push([blue("Description"), actor.details.description]);
  }

  lines.push([
    yellow("Owner Address"),
    (await actor.ensOwnerAddress) || formatAddress(actor.ownerAddr),
  ]);
  lines.push([
    yellow("Billing Address"),
    (await actor.ensBillingAddress) || formatAddress(actor.billingAddr),
  ]);
  lines.push([
    yellow("Operator Address"),
    (await actor.ensOperatorAddress) || formatAddress(actor.operatorAddr),
  ]);

  const registrationDate = dayjs.unix(Number(actor.registrationTs));
  lines.push([
    green("Registered at (Network level)"),
    registrationDate.format("DD MMMM YYYY"),
  ]);

  lines.push([green.bold("CID"), actor.detailsLink]);

  for (const [key, value] of lines) {
    if (value === undefined) {
      console.log(key);
    } else {
      console.log(`${key}:`, value);
    }
  }

  await handler?.(actor);

  if (actor.details && actor.details.cid != actor.detailsLink) {
    console.error(
      yellow.bold(
        `\nWARNING: CID of the details file is different than the one committed on-chain.`
      )
    );
  }
}
