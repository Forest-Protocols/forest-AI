import { Command } from "commander";
import { OPTIONS } from "./options";
import { spinner } from "@/program";
import { checkValidationError } from "@/validation/error-handling";
import { z } from "zod";
import { accountFileOrKeySchema } from "@/validation/account";
import { privateKeyToAccount } from "viem/accounts";
import { DECIMALS } from "@forest-protocols/sdk";
import { createViemPublicClient } from "@/utils";
import { parseUnits } from "viem";
import { createSlasherInstance } from "@/client";
import { green } from "ansis";
import { resolveENSName } from "@/utils/address";

export function createWithdrawActorCollateralCommand(parent: Command) {
  return parent
    .command("withdraw-collateral")
    .description("Withdraws collateral of an Actor from the given Protocol")
    .option(
      OPTIONS.ACCOUNT.FLAGS,
      OPTIONS.ACCOUNT.DESCRIPTION,
      OPTIONS.ACCOUNT.HANDLER
    )
    .requiredOption(OPTIONS.PT_ADDRESS.FLAGS, OPTIONS.PT_ADDRESS.DESCRIPTION)
    .requiredOption(
      "--amount <number>",
      "The amount of FOREST token will be withdrawn"
    )
    .action(async (rawOptions: any) => {
      const options = checkValidationError(
        z
          .object({
            account: accountFileOrKeySchema,
            ptAddress: z.string(),
            amount: z.coerce.number(),
          })
          .safeParse({
            account: rawOptions[OPTIONS.ACCOUNT.OPTION_NAME],
            ptAddress: rawOptions[OPTIONS.PT_ADDRESS.OPTION_NAME],
            amount: rawOptions.amount,
          })
      );

      const ptAddress = await resolveENSName(options.ptAddress);
      const { account, amount } = options;

      const parsedAmount = parseUnits(amount.toString(), DECIMALS.FOREST);
      const acc = privateKeyToAccount(account);
      const client = createViemPublicClient();
      const slasher = createSlasherInstance(client, acc);

      spinner.start("Withdrawing collateral");
      await slasher.withdrawActorCollateral(ptAddress, parsedAmount);
      spinner.succeed(green("Collateral withdrawn successfully"));
    });
}
