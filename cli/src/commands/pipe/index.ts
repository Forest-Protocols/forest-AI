import { program, spinner } from "@/program";
import { OPTIONS } from "../common/options";
import { checkValidationError } from "@/validation/error-handling";
import { z } from "zod";
import {
  PipeMethods,
  PipeMethodType,
  PipeResponseCodes,
} from "@forest-protocols/sdk";
import { JSONSchema } from "@/validation/json";
import { createAccount, createHTTPPipe, createXMTPPipe } from "@/utils";
import { resolveENSName } from "@/utils/address";
import { green, red, yellow } from "ansis";
import { config } from "@/config";
export const pipeCommand = program

  .command("pipe")
  .description("Sends a message over a Pipe (XMTP or HTTP) to a listener")
  .requiredOption(
    "--to <address>",
    "Receiver address (wallet address for XMTP and hostname for HTTP Pipes."
  )
  .requiredOption(
    "--method <method>",
    "Pipe method type; GET, POST, DELETE, PUT or PATCH"
  )
  .requiredOption("--path <path>", "Target endpoint")
  .option("--body <JSON>", "Body of the request")
  .option("--params <JSON>", "Parameters of the request")
  .option("--timeout <seconds>", "Timeout in seconds")
  .option(OPTIONS.PIPE.FLAGS, OPTIONS.PIPE.DESCRIPTION, OPTIONS.PIPE.HANDLER)
  .option(
    OPTIONS.ACCOUNT.FLAGS,
    OPTIONS.ACCOUNT.DESCRIPTION,
    OPTIONS.ACCOUNT.HANDLER
  )
  .action(async (rawOptions: any) => {
    const options = checkValidationError(
      z
        .object({
          to: z.string(),
          path: z.string().nonempty(),
          method: z.string().transform((value, ctx) => {
            value = value.toUpperCase();
            const result = z.nativeEnum(PipeMethods).safeParse(value);
            if (result.error) {
              ctx.addIssue(result.error.issues[0]);
              return z.NEVER;
            }

            return value as PipeMethodType;
          }),
          body: JSONSchema.optional(),
          params: JSONSchema.optional(),
          timeout: z.coerce.number().optional(),
        })
        .safeParse({
          to: rawOptions.to,
          path: rawOptions.path,
          method: rawOptions.method,
          body: rawOptions.body,
          params: rawOptions.params,
          timeout: rawOptions.timeout,
        })
    );

    spinner.start("Initializing Pipe");
    const to = await resolveENSName(options.to);
    const account = createAccount({ useDefault: true });
    const pipe =
      config.pipe.value === "xmtp"
        ? await createXMTPPipe(account)
        : await createHTTPPipe(account);

    spinner.text = "Waiting response";
    const res = await pipe.send(to, {
      method: options.method,
      path: options.path,
      body: options.body,
      params: options.params,
      timeout: options.timeout ? options.timeout * 1000 : undefined,
    });

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
      console.log(JSON.stringify(res.body, null, 2));
    }
  });
