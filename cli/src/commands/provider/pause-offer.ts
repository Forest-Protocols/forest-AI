import { checkValidationError } from "@/validation/error-handling";
import { z } from "zod";
import { addressSchema } from "@forest-protocols/sdk";
import { accountFileOrKeySchema } from "@/validation/account";
import { privateKeyToAccount } from "viem/accounts";
import { spinner } from "@/program";
import { green } from "ansis";
import { providerCommand } from ".";
import { createViemPublicClient } from "@/utils";
import { createProtocolInstance } from "@/client";
import { OPTIONS } from "../common/options";

providerCommand
  .command("pause-offer")
  .description("Pauses an Offer making new purchases not possible")
  .option(
    OPTIONS.ACCOUNT.FLAGS,
    OPTIONS.ACCOUNT.DESCRIPTION,
    OPTIONS.ACCOUNT.HANDLER
  )
  .requiredOption(OPTIONS.OFFER_ID.FLAGS, OPTIONS.OFFER_ID.DESCRIPTION)
  .requiredOption(OPTIONS.PT_ADDRESS.FLAGS, OPTIONS.PT_ADDRESS.DESCRIPTION)
  .action(async (rawOptions: any) => {
    const options = checkValidationError(
      z
        .object({
          ptAddress: addressSchema,
          offerId: z.coerce.number(),
          account: accountFileOrKeySchema,
        })
        .safeParse({
          account: rawOptions[OPTIONS.ACCOUNT.OPTION_NAME],
          ptAddress: rawOptions[OPTIONS.PT_ADDRESS.OPTION_NAME],
          offerId: rawOptions[OPTIONS.OFFER_ID.OPTION_NAME],
        })
    );

    const account = privateKeyToAccount(options.account);
    const client = createViemPublicClient();
    const pt = createProtocolInstance(client, options.ptAddress, account);

    spinner.start("Pausing the Offer");
    await pt.pauseOffer(options.offerId);
    spinner.succeed(green(`Done`));
  });
