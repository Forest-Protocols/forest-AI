import {
  ActorDetailsSchema,
  ActorType,
  actorTypeToString,
  addressSchema,
  generateCID,
} from "@forest-protocols/sdk";
import { Command } from "commander";
import { OPTIONS } from "./options";
import { checkValidationError } from "@/validation/error-handling";
import { z } from "zod";
import { accountFileOrKeySchema } from "@/validation/account";
import { privateKeyToAccount } from "viem/accounts";
import { fileSchema } from "@/validation/file";
import { createViemPublicClient, truncateAddress } from "@/utils";
import { spinner } from "@/program";
import { green } from "ansis";
import { createRegistryInstance } from "@/client";

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
      "Operator address to use in XMTP communication. Uses Actor's account address by default."
    )
    .action(async (rawOptions: any) => {
      const options = checkValidationError(
        z
          .object({
            details: fileSchema.optional(),
            billing: addressSchema.optional(),
            operator: addressSchema.optional(),
            account: accountFileOrKeySchema,
          })
          .safeParse({
            details: rawOptions.details,
            billing: rawOptions.billing,
            operator: rawOptions.operator,
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
      const actor = await registry.getActor(account.address);

      if (!actor) {
        throw new Error(`${actorTypeString} is not registered in the Network`);
      }

      spinner.text = "Updating details";

      const detailsLink = options.details
        ? (await generateCID(options.details)).toString()
        : actor.detailsLink;
      const operator = options.operator || actor.operatorAddr;
      const billing = options.billing || actor.billingAddr;

      await registry.updateActorDetails(
        actorType,
        detailsLink,
        operator,
        billing
      );
      spinner.succeed(green("Done"));

      console.log(
        green.bold(
          `${actorTypeString} ${await truncateAddress(actor.ownerAddr)}`
        )
      );
      console.log(green.bold(`CID       : ${detailsLink}`));
      console.log(green.bold(`Operator  : ${await truncateAddress(operator)}`));
      console.log(green.bold(`Billing   : ${await truncateAddress(billing)}`));
    });
}
