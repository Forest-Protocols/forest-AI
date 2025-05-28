import z from "zod";
import { spinner } from "@/program";
import { slasherCommand } from ".";
import { OPTIONS } from "../common/options";
import { accountFileOrKeySchema } from "@/validation/account";
import { privateKeyToAccount } from "viem/accounts";
import { green } from "ansis";
import { checkValidationError } from "@/validation/error-handling";
import { createViemPublicClient } from "@/utils";
import { createSlasherInstance } from "@/client";

slasherCommand
  .command("unpause")
  .option(
    OPTIONS.ACCOUNT.FLAGS,
    OPTIONS.ACCOUNT.DESCRIPTION,
    OPTIONS.ACCOUNT.HANDLER
  )
  .description("Unpauses the Forest Slasher, makes it usable again")
  .action(async (rawOptions: any) => {
    const args = checkValidationError(
      z
        .object({ account: accountFileOrKeySchema })
        .safeParse({ account: rawOptions[OPTIONS.ACCOUNT.OPTION_NAME] })
    );

    const acc = privateKeyToAccount(args.account);
    const client = createViemPublicClient();
    const slasher = createSlasherInstance(client, acc);

    spinner.start("Unpausing Forest Slasher");
    await slasher.unpause();
    spinner.succeed(green("Done"));
  });
