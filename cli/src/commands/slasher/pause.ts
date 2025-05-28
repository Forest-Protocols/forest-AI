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
  .command("pause")
  .option(
    OPTIONS.ACCOUNT.FLAGS,
    OPTIONS.ACCOUNT.DESCRIPTION,
    OPTIONS.ACCOUNT.HANDLER
  )
  .description("Pauses the Forest Slasher, makes it unusable")
  .action(async (rawOptions: any) => {
    const args = checkValidationError(
      z
        .object({ account: accountFileOrKeySchema })
        .safeParse({ account: rawOptions[OPTIONS.ACCOUNT.OPTION_NAME] })
    );

    const acc = privateKeyToAccount(args.account);
    const client = createViemPublicClient();
    const slasher = createSlasherInstance(client, acc);

    spinner.start("Pausing Forest Slasher");
    await slasher.pause();
    spinner.succeed(green("Done"));
  });
