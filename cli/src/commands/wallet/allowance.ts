import { walletCommand } from ".";
import { spinner } from "@/program";
import { green } from "ansis";
import { checkValidationError } from "@/validation/error-handling";
import { z } from "zod";
import { addressSchema, DECIMALS } from "@forest-protocols/sdk";
import { createViemPublicClient } from "@/utils";
import { OPTIONS } from "../common/options";
import { accountFileOrKeySchema } from "@/validation/account";
import { privateKeyToAccount } from "viem/accounts";
import { createTokenInstance } from "@/client";

walletCommand
  .command("allowance")
  .description("Sets FOREST token allowance for the given spenders")
  .option(
    OPTIONS.ACCOUNT.FLAGS,
    OPTIONS.ACCOUNT.DESCRIPTION,
    OPTIONS.ACCOUNT.HANDLER
  )
  .requiredOption("--amount <number>", "Amount of FOREST token")
  .requiredOption("--spender <spenders...>", "Spender address(es)")
  .action(async (rawOptions: any) => {
    const options = checkValidationError(
      z
        .object({
          account: accountFileOrKeySchema,
          amount: z.coerce.number(),
          spenders: z.array(addressSchema).min(1),
        })
        .safeParse({
          account: rawOptions[OPTIONS.ACCOUNT.OPTION_NAME],
          amount: rawOptions.amount,
          spenders: rawOptions.spender,
        })
    );

    const account = privateKeyToAccount(options.account);
    const client = createViemPublicClient();
    const token = createTokenInstance(client, account);

    for (const spender of options.spenders) {
      spinner.start(`Setting allowance for ${spender}`);
      await token.setAllowance(
        spender,
        BigInt(options.amount * Math.pow(10, DECIMALS.FOREST))
      );
      spinner.succeed(
        green(`Allowance has been set ${options.amount} FOREST for ${spender}`)
      );
    }
  });
