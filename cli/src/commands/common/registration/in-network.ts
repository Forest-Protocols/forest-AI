import { spinner } from "@/program";
import {
  ActorType,
  generateCID,
  actorTypeToString,
  DECIMALS,
  ActorDetailsSchema,
} from "@forest-protocols/sdk";
import { z } from "zod";
import { Command } from "commander";
import { formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { green } from "ansis";
import { accountFileOrKeySchema } from "@/validation/account";
import { checkValidationError } from "@/validation/error-handling";
import { checkAndAskAllowance, createViemPublicClient } from "@/utils";
import { OPTIONS } from "../options";
import { fileSchema } from "@/validation/file";
import {
  createRegistryInstance,
  createTokenInstance,
  indexerClient,
} from "@/client";
import { formatAddress, resolveENSName } from "@/utils/address";

export function createRegisterActorCommand(cmd: Command, actorType: ActorType) {
  return cmd
    .option(
      OPTIONS.ACCOUNT.FLAGS,
      OPTIONS.ACCOUNT.DESCRIPTION,
      OPTIONS.ACCOUNT.HANDLER
    )
    .option(
      "--billing <address>",
      "Billing address that rewards/payments goes to. Uses Actor's account by default."
    )
    .option(
      "--operator <address>",
      "Operator address to use in XMTP communication. Uses Actor's account address by default."
    )
    .option(
      "-E, --endpoint <base url>",
      "The endpoint of the Operator for Pipe communication"
    )
    .requiredOption("--details <file>", "Detailed information about the Actor.")
    .action(async (rawOptions: any) => {
      const options = checkValidationError(
        z
          .object({
            details: fileSchema,
            billing: z.string().optional(),
            operator: z.string().optional(),
            account: accountFileOrKeySchema,
            endpoint: z.string().optional(),
          })
          .safeParse({
            details: rawOptions.details,
            billing: rawOptions.billing,
            operator: rawOptions.operator,
            account: rawOptions[OPTIONS.ACCOUNT.OPTION_NAME],
            endpoint: rawOptions.endpoint,
          })
      );

      // Validate the schema of the details file
      checkValidationError(
        ActorDetailsSchema.safeParse(JSON.parse(options.details))
      );

      const client = createViemPublicClient();
      const account = privateKeyToAccount(options.account);
      const registry = createRegistryInstance(client, account);
      const token = createTokenInstance(client, account);

      spinner.start("Checking Actor");
      const [actor, operatorAddress, billingAddress] = await Promise.all([
        indexerClient
          .getActorByIdOrAddress(account.address)
          // TODO: Indexer client should return undefined if the Actor is not found and throw error only if something went wrong (e.g network issue)
          .catch(() => undefined),
        options.operator ? resolveENSName(options.operator) : undefined,
        options.billing ? resolveENSName(options.billing) : undefined,
      ]);

      if (actor) {
        throw new Error(
          `The account ${formatAddress(
            account.address
          )} is already registered in the Network as a ${actorTypeToString(
            actor.type
          )}. ID: ${actor.id}`
        );
      }

      spinner.text = "Checking fees, balance and allowance";
      const [registrationFee, balance, allowance] = await Promise.all([
        indexerClient.getActorRegistrationFeeInNetwork(),
        token.getBalance(account.address),
        token.getAllowance(account.address, registry.address),
      ]);

      if (balance < registrationFee) {
        throw new Error(
          `Your balance (${formatUnits(
            balance,
            DECIMALS.FOREST
          )} FOREST) is not enough to register in the Network (${formatUnits(
            registrationFee,
            DECIMALS.FOREST
          )} FOREST).`
        );
      }

      await checkAndAskAllowance(
        allowance,
        registrationFee,
        registry.address,
        (spender, amount) => token.setAllowance(spender, amount),
        "FOREST",
        DECIMALS.FOREST,
        "Forest Registry",
        "for registration fees"
      );

      spinner.start(
        `Registering in the Network as a ${actorTypeToString(actorType)}`
      );

      const cid = await generateCID(options.details);
      const actorId = await registry.registerActor(
        actorType,
        cid.toString(),
        billingAddress,
        operatorAddress,
        options.endpoint
      );

      spinner.succeed(
        green(`${actorTypeToString(actorType)} registration is completed!`)
      );
      console.log(green.bold(`ID        : ${actorId}`));
      console.log(green.bold(`Address   : ${account.address}`));
      console.log(green.bold(`CID       : ${cid.toString()}`));
    });
}
