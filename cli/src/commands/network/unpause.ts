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
  .command("unpause")
  .description("Unpauses the Network, make registrations possible again")
  .option(
    OPTIONS.ACCOUNT.FLAGS,
    OPTIONS.ACCOUNT.DESCRIPTION,
    OPTIONS.ACCOUNT.HANDLER
  )
  .action(async (options: any) => {
    const args = checkValidationError(
      z
        .object({
          account: accountFileOrKeySchema,
        })
        .safeParse(options)
    );

    const client = createViemPublicClient();
    const account = privateKeyToAccount(args.account);
    const registry = createRegistryInstance(client, account);

    spinner.start("Unpausing the Network");

    await registry.unpauseProtocol();

    spinner.succeed(green("Network has successfully unpaused"));
  });
