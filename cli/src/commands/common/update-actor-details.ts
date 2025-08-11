import {
  ActorDetailsSchema,
  ActorType,
  actorTypeToString,
  generateCID,
} from "@forest-protocols/sdk";
import { Command } from "commander";
import { OPTIONS } from "./options";
import { checkValidationError } from "@/validation/error-handling";
import { z } from "zod";
import { accountFileOrKeySchema } from "@/validation/account";
import { privateKeyToAccount } from "viem/accounts";
import { fileSchema } from "@/validation/file";
import { createViemPublicClient } from "@/utils";
import { spinner } from "@/program";
import { green } from "ansis";
import { createRegistryInstance, indexerClient } from "@/client";
import { formatAddress, resolveENSName } from "@/utils/address";

export function createUpdateDetailsCommand(
  parent: Command,
  actorType: ActorType
) {
  const actorTypeString = actorTypeToString(actorType);
  return parent
    .command("update")
    .description(`Updates the given details of a registered ${actorTypeString}`)
    .option(
      OPTIONS.ACCOUNT.FLAGS,
      OPTIONS.ACCOUNT.DESCRIPTION,
      OPTIONS.ACCOUNT.HANDLER
    )
    .option(
      "--details <file>",
      `Detailed information about the ${actorTypeString}.`
    )
    .option(
      "--billing <address>",
      "Billing address that rewards/payments goes to. Uses Actor's account by default."
    )
    .option(
      "--operator <address>",
      "Operator address that responsible for the running the daemon software. Uses Actor's account address by default."
    )
    .option(
      "--endpoint <endpoint>",
      "Endpoint to use in HTTP Pipe communication. Empty by default"
    )
    .action(async (rawOptions: any) => {
      const options = checkValidationError(
        z
          .object({
            details: fileSchema.optional(),
            billing: z.string().optional(),
            operator: z.string().optional(),
            endpoint: z.string().optional(),
            account: accountFileOrKeySchema,
          })
          .safeParse({
            details: rawOptions.details,
            billing: rawOptions.billing,
            operator: rawOptions.operator,
            endpoint: rawOptions.endpoint,
            account: rawOptions[OPTIONS.ACCOUNT.OPTION_NAME],
          })
      );

      if (options.details) {
        checkValidationError(
          ActorDetailsSchema.safeParse(JSON.parse(options.details))
        );
      }

      const account = privateKeyToAccount(options.account);
      const client = createViemPublicClient();
      const registry = createRegistryInstance(client, account);

      spinner.start("Getting current properties");
      const actor = await indexerClient.getActorByIdOrAddress(account.address);

      if (!actor) {
        throw new Error(`${actorTypeString} is not registered in the Network`);
      }

      spinner.text = "Updating details";

      const detailsLink = options.details
        ? (await generateCID(options.details)).toString()
        : actor.detailsLink;
      const [operator, billing] = await Promise.all([
        options.operator
          ? resolveENSName(options.operator)
          : actor.operatorAddress,
        options.billing
          ? resolveENSName(options.billing)
          : actor.billingAddress,
      ]);

      await registry.updateActorDetails(
        actorType,
        detailsLink,
        operator,
        billing,
        options.endpoint || actor.endpoint
      );
      spinner.succeed(green("Done"));

      console.log(
        green.bold(`${actorTypeString} ${formatAddress(actor.ownerAddress)}`)
      );
      console.log(green.bold(`CID       : ${detailsLink}`));
      console.log(green.bold(`Operator  : ${formatAddress(operator)}`));
      console.log(green.bold(`Billing   : ${formatAddress(billing)}`));
    });
}
