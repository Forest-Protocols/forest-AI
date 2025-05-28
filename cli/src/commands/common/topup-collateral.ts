import { Command } from "commander";
import { OPTIONS } from "./options";
import { checkValidationError } from "@/validation/error-handling";
import { z } from "zod";
import { accountFileOrKeySchema } from "@/validation/account";
import { privateKeyToAccount } from "viem/accounts";
import { addressSchema, DECIMALS } from "@forest-protocols/sdk";
import { checkAndAskAllowance, createViemPublicClient } from "@/utils";
import { parseUnits } from "viem";
import { createSlasherInstance, createTokenInstance } from "@/client";
import { spinner } from "@/program";
import { green } from "ansis";

export function createTopUpCollateralCommand(parent: Command) {
  return parent
    .command("topup-collateral")
    .description(
      "Adds more collateral to the caller Actor in the given Protocol."
    )
    .option(
      OPTIONS.ACCOUNT.FLAGS,
      OPTIONS.ACCOUNT.DESCRIPTION,
      OPTIONS.ACCOUNT.HANDLER
    )
    .requiredOption(OPTIONS.PT_ADDRESS.FLAGS, OPTIONS.PT_ADDRESS.DESCRIPTION)
    .requiredOption(
      "--amount <number>",
      `This amount of FOREST token will be added to the Actor's collateral.`
    )
    .action(async (rawOptions: any) => {
      const options = checkValidationError(
        z
          .object({
            account: accountFileOrKeySchema,
            ptAddress: addressSchema,
            amount: z.coerce.number(),
          })
          .safeParse({
            account: rawOptions[OPTIONS.ACCOUNT.OPTION_NAME],
            ptAddress: rawOptions[OPTIONS.PT_ADDRESS.OPTION_NAME],
            amount: rawOptions.amount,
          })
      );

      const { ptAddress, account, amount } = options;
      const parsedAmount = parseUnits(amount.toString(), DECIMALS.FOREST);

      const acc = privateKeyToAccount(account);
      const client = createViemPublicClient();
      const token = createTokenInstance(client, acc);
      const slasher = createSlasherInstance(client, acc);

      spinner.start("Checking allowance");
      const allowance = await token.getAllowance(acc.address, slasher.address);

      await checkAndAskAllowance(
        allowance,
        parsedAmount,
        slasher.address,
        (spender, amount) => token.setAllowance(spender, amount),
        "FOREST",
        DECIMALS.FOREST,
        "Forest Slasher",
        "for collateral top-up"
      );

      spinner.text = "Adding collateral";
      await slasher.topupActorCollateral(ptAddress, parsedAmount);
      spinner.succeed(green("Collateral added successfully"));
    });
}
