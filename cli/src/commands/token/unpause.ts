import z from "zod";
import { spinner } from "@/program";
import { tokenCommand } from ".";
import { OPTIONS } from "../common/options";
import { accountFileOrKeySchema } from "@/validation/account";
import { privateKeyToAccount } from "viem/accounts";
import { green } from "ansis";
import { checkValidationError } from "@/validation/error-handling";
import { createViemPublicClient } from "@/utils";
import { createTokenInstance } from "@/client";

tokenCommand
  .command("unpause")
  .option(
    OPTIONS.ACCOUNT.FLAGS,
    OPTIONS.ACCOUNT.DESCRIPTION,
    OPTIONS.ACCOUNT.HANDLER
  )
  .description("Unpauses the FOREST Token, makes it usable again")
  .action(async (rawOptions: any) => {
    const options = checkValidationError(
      z
        .object({ account: accountFileOrKeySchema })
        .safeParse({ account: rawOptions[OPTIONS.ACCOUNT.OPTION_NAME] })
    );

    const acc = privateKeyToAccount(options.account);
    const client = createViemPublicClient();
    const token = createTokenInstance(client, acc);

    spinner.start("Unpausing Forest Token");
    await token.unpause();
    spinner.succeed(green("Done"));
  });
