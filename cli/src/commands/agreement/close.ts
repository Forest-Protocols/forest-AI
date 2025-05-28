import { agreementCommand } from ".";
import { OPTIONS } from "../common/options";
import { checkValidationError } from "@/validation/error-handling";
import { z } from "zod";
import { addressSchema } from "@forest-protocols/sdk";
import { accountFileOrKeySchema } from "@/validation/account";
import { privateKeyToAccount } from "viem/accounts";
import { spinner } from "@/program";
import { green } from "ansis";
import { createViemPublicClient } from "@/utils";
import { createProtocolInstance } from "@/client";

agreementCommand
  .command("close")
  .summary("Closes an Agreement")
  .description(
    "Closes an Agreement. If the caller is the Provider and the Agreement has run out of balance, force closes it. Otherwise caller has to be the owner of the Agreement."
  )
  .option(
    OPTIONS.ACCOUNT.FLAGS,
    OPTIONS.ACCOUNT.DESCRIPTION,
    OPTIONS.ACCOUNT.HANDLER
  )
  .requiredOption(OPTIONS.AGREEMENT_ID.FLAGS, OPTIONS.AGREEMENT_ID.DESCRIPTION)
  .requiredOption(OPTIONS.PT_ADDRESS.FLAGS, OPTIONS.PT_ADDRESS.DESCRIPTION)
  .action(async (rawOptions: any) => {
    const options = checkValidationError(
      z
        .object({
          ptAddress: addressSchema,
          agreementId: z.coerce.number(),
          account: accountFileOrKeySchema,
        })
        .safeParse({
          account: rawOptions[OPTIONS.ACCOUNT.OPTION_NAME],
          ptAddress: rawOptions[OPTIONS.PT_ADDRESS.OPTION_NAME],
          agreementId: rawOptions[OPTIONS.AGREEMENT_ID.OPTION_NAME],
        })
    );

    const account = privateKeyToAccount(options.account);
    const client = createViemPublicClient();
    const pt = createProtocolInstance(client, options.ptAddress, account);

    spinner.start("Closing the agreement");
    await pt.closeAgreement(options.agreementId);

    spinner.succeed(
      green(`Agreement ${options.agreementId} closed successfully`)
    );
  });
