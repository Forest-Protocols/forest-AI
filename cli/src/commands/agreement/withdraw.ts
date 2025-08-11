import { agreementCommand } from ".";
import { checkValidationError } from "@/validation/error-handling";
import { z } from "zod";
import { accountFileOrKeySchema } from "@/validation/account";
import { privateKeyToAccount } from "viem/accounts";
import { DECIMALS } from "@forest-protocols/sdk";
import { parseUnits } from "viem";
import { createViemPublicClient } from "@/utils";
import { OPTIONS } from "../common/options";
import { createProtocolInstance } from "@/client";
import { spinner } from "@/program";
import { green } from "ansis";
import { resolveENSName } from "@/utils/address";

agreementCommand
  .command("withdraw")
  .description("Withdraws some of the deposit from an Agreement")
  .option(
    OPTIONS.ACCOUNT.FLAGS,
    OPTIONS.ACCOUNT.DESCRIPTION,
    OPTIONS.ACCOUNT.HANDLER
  )
  .requiredOption(OPTIONS.AGREEMENT_ID.FLAGS, OPTIONS.AGREEMENT_ID.DESCRIPTION)
  .requiredOption(OPTIONS.PT_ADDRESS.FLAGS, OPTIONS.PT_ADDRESS.DESCRIPTION)
  .requiredOption("--amount <number>", "Amount of USDC to be withdrawn")
  .action(async (rawOptions: any) => {
    const options = checkValidationError(
      z
        .object({
          ptAddress: z.string(),
          agreementId: z.coerce.number(),
          account: accountFileOrKeySchema,
          amount: z.coerce.number(),
        })
        .safeParse({
          account: rawOptions[OPTIONS.ACCOUNT.OPTION_NAME],
          ptAddress: rawOptions[OPTIONS.PT_ADDRESS.OPTION_NAME],
          agreementId: rawOptions[OPTIONS.AGREEMENT_ID.OPTION_NAME],
          amount: rawOptions.amount,
        })
    );

    const ptAddress = await resolveENSName(options.ptAddress);
    const { account, amount, agreementId } = options;
    const parsedAmount = parseUnits(amount.toString(), DECIMALS.USDC);
    const acc = privateKeyToAccount(account);

    const client = createViemPublicClient();
    spinner.start(`Withdrawing ${amount} USDC from Agreement ${agreementId}`);

    const pt = createProtocolInstance(client, ptAddress, acc);
    await pt.withdrawUserBalance(agreementId, parsedAmount);

    spinner.succeed(green("Done."));
  });
