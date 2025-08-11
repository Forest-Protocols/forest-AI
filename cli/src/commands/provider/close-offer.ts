import { OPTIONS } from "../common/options";
import { checkValidationError } from "@/validation/error-handling";
import { z } from "zod";
import { accountFileOrKeySchema } from "@/validation/account";
import { privateKeyToAccount } from "viem/accounts";
import { spinner } from "@/program";
import { green } from "ansis";
import { providerCommand } from ".";
import { createViemPublicClient } from "@/utils";
import { createProtocolInstance } from "@/client";
import { resolveENSName } from "@/utils/address";

providerCommand
  .command("close-offer")
  .description(
    "Marks an Offer as to be closed after Protocol's termUpdateDelay finalizes. Doesn't pause the Offer for new Agreements"
  )
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
          ptAddress: z.string(),
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
    const pt = createProtocolInstance(
      client,
      await resolveENSName(options.ptAddress),
      account
    );

    spinner.start("Marking offer as closed");
    await pt.requestOfferClose(options.offerId);
    spinner.succeed(green(`Done`));
  });
