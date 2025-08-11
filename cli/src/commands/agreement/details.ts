import { agreementCommand } from ".";
import { OPTIONS } from "../common/options";
import { checkValidationError } from "@/validation/error-handling";
import { z } from "zod";
import { PipeMethods, PipeResponseCodes } from "@forest-protocols/sdk";
import { accountFileOrKeySchema } from "@/validation/account";
import { spinner } from "@/program";
import { createHTTPPipe, createXMTPPipe } from "@/utils";
import { indexerClient } from "@/client";
import { blue, green, red, yellow } from "ansis";
import { resolveENSName } from "@/utils/address";
import { config } from "@/config";

agreementCommand
  .command("details")
  .alias("get")
  .description("Shows the details of the given Agreement")
  .option(
    OPTIONS.ACCOUNT.FLAGS,
    OPTIONS.ACCOUNT.DESCRIPTION,
    OPTIONS.ACCOUNT.HANDLER
  )
  .option(OPTIONS.PIPE.FLAGS, OPTIONS.PIPE.DESCRIPTION, OPTIONS.PIPE.HANDLER)
  .option(OPTIONS.PIPE_ENDPOINT.FLAGS, OPTIONS.PIPE_ENDPOINT.DESCRIPTION)
  .requiredOption(OPTIONS.AGREEMENT_ID.FLAGS, OPTIONS.AGREEMENT_ID.DESCRIPTION)
  .requiredOption(OPTIONS.PT_ADDRESS.FLAGS, OPTIONS.PT_ADDRESS.DESCRIPTION)
  .action(async (rawOptions: any) => {
    const options = checkValidationError(
      z
        .object({
          ptAddress: z.string(),
          agreementId: z.coerce.number(),
          account: accountFileOrKeySchema,
          endpoint: z.string().optional(),
        })
        .safeParse({
          account: rawOptions[OPTIONS.ACCOUNT.OPTION_NAME],
          ptAddress: rawOptions[OPTIONS.PT_ADDRESS.OPTION_NAME],
          agreementId: rawOptions[OPTIONS.AGREEMENT_ID.OPTION_NAME],
          endpoint: rawOptions[OPTIONS.PIPE_ENDPOINT.OPTION_NAME],
        })
    );

    const ptAddress = await resolveENSName(options.ptAddress);

    spinner.start("Getting Agreement");
    const agreement = await indexerClient
      .getAgreements({
        protocolAddress: ptAddress,
        id: options.agreementId,
      })
      .then((res) => res.data[0]);

    if (!agreement) {
      throw new Error(`Agreement ${options.agreementId} not found`);
    }

    const provider = await indexerClient.getActorByIdOrAddress(
      agreement.providerAddress
    );
    const operatorEndpoint = provider.endpoint;

    if (
      config.pipe.value === "http" &&
      !options.endpoint &&
      !operatorEndpoint
    ) {
      throw new Error("Endpoint is required when HTTP Pipe is used");
    }

    spinner.text = "Initializing Pipe";
    const pipe =
      config.pipe.value === "xmtp"
        ? await createXMTPPipe(options.account)
        : await createHTTPPipe(options.account);

    spinner.text = "Waiting response from the Operator";
    const res = await pipe.send(
      config.pipe.value === "xmtp"
        ? await resolveENSName(provider.operatorAddress)
        : options.endpoint || operatorEndpoint,
      {
        method: PipeMethods.GET,
        path: "/resources",
        params: {
          id: agreement.id,
          pt: agreement.protocolAddress,
        },
        timeout: 10 * 1000,
      }
    );

    switch (res.code) {
      case PipeResponseCodes.BAD_REQUEST:
      case PipeResponseCodes.INTERNAL_SERVER_ERROR:
      case PipeResponseCodes.NOT_AUTHORIZED:
      case PipeResponseCodes.NOT_FOUND:
        spinner.fail(red.bold(`Response ${res.code}`));
        break;
      case PipeResponseCodes.OK:
        spinner.succeed(green.bold(`Response ${res.code}`));
        break;
    }

    await pipe.close();

    if (res.body) {
      console.log(yellow(`Body:`));
      console.log(blue.bold(JSON.stringify(res.body, null, 2)));
    }
  });
