import z from "zod";
import { networkCommand } from ".";
import { OPTIONS } from "../common/options";
import { accountFileOrKeySchema } from "@/validation/account";
import { privateKeyToAccount } from "viem/accounts";
import { spinner } from "@/program";
import { green } from "ansis";
import { createRegistryInstance } from "@/client";
import { checkValidationError } from "@/validation/error-handling";
import { createViemPublicClient } from "@/utils";

networkCommand
  .command("pause")
  .description("Pauses the Network, makes new registrations impossible")
  .option(
    OPTIONS.ACCOUNT.FLAGS,
    OPTIONS.ACCOUNT.DESCRIPTION,
    OPTIONS.ACCOUNT.HANDLER
  )
  .action(async (rawOptions: any) => {
    const options = checkValidationError(
      z
        .object({
          account: accountFileOrKeySchema,
        })
        .safeParse({
          account: rawOptions[OPTIONS.ACCOUNT.OPTION_NAME],
        })
    );

    const client = createViemPublicClient();
    const account = privateKeyToAccount(options.account);
    const registry = createRegistryInstance(client, account);

    spinner.start("Pausing the Network");

    await registry.pauseProtocol();

    spinner.succeed(green("Network has successfully paused"));
  });
