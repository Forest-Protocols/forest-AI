import { agreementCommand } from ".";
import { OPTIONS } from "../common/options";
import { checkValidationError } from "@/validation/error-handling";
import { z } from "zod";
import {
  addressSchema,
  PipeMethod,
  PipeResponseCode,
} from "@forest-protocols/sdk";
import { accountFileOrKeySchema } from "@/validation/account";
import { privateKeyToAccount } from "viem/accounts";
import { spinner } from "@/program";
import { createViemPublicClient, createXMTPPipe } from "@/utils";
import { createProtocolInstance, createRegistryInstance } from "@/client";
import { blue, green, red, yellow } from "ansis";

agreementCommand
  .command("details")
  .alias("get")
  .description("Shows the details of the given Agreement")
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
    const registry = createRegistryInstance(client);
    const pt = createProtocolInstance(client, options.ptAddress, account);

    spinner.start("Checking agreement");
    const agreement = await pt.getAgreement(options.agreementId);

    if (!agreement) {
      throw new Error(`Agreement ${options.agreementId} not found`);
    }

    const offer = await pt.getOffer(agreement.offerId);
    const provider = (await registry.getActor(offer.ownerAddr))!;

    spinner.text = "Initializing Pipe";
    const pipe = await createXMTPPipe(options.account);

    spinner.text = "Waiting response from the Operator";
    const res = await pipe.send(provider.operatorAddr, {
      method: PipeMethod.GET,
      path: "/resources",
      params: {
        id: agreement.id,
        pt: pt.address,

        // TODO: Remove in the next versions, just for backward compatibility
        pc: pt.address,
      },
      timeout: 10 * 1000,
    });

    switch (res.code) {
      case PipeResponseCode.BAD_REQUEST:
      case PipeResponseCode.INTERNAL_SERVER_ERROR:
      case PipeResponseCode.NOT_AUTHORIZED:
      case PipeResponseCode.NOT_FOUND:
        spinner.fail(red.bold(`Response ${res.code}`));
        break;
      case PipeResponseCode.OK:
        spinner.succeed(green.bold(`Response ${res.code}`));
        break;
    }

    await pipe.close();

    if (res.body) {
      console.log(yellow(`Body:`));
      console.log(blue.bold(JSON.stringify(res.body, null, 2)));
    }
  });
