import { readFileSync, statSync } from "fs";
import { apiCommand } from ".";
import { spinner } from "@/program";
import { green } from "ansis";
import { createHTTPPipe, createXMTPPipe } from "@/utils";
import { checkValidationError } from "@/validation/error-handling";
import {
  addressSchema,
  PipeMethods,
  PipeResponseCodes,
} from "@forest-protocols/sdk";
import { sm } from "@/config/spec";
import { resolveToAddress } from "@/utils/address";
import { indexerClient } from "@/client";
import { Address } from "viem";
import { OPTIONS } from "../common/options";
import { config } from "@/config";

apiCommand
  .command("import")
  .summary("Imports OpenAPI spec of a Provider")
  .description("Imports OpenAPI spec of a Provider from a URL or local path")
  .argument(
    "<path or URL or Operator Address>",
    "Path, URL or the Operator Address that has the OpenAPI spec"
  )
  .option(OPTIONS.PIPE.FLAGS, OPTIONS.PIPE.DESCRIPTION, OPTIONS.PIPE.HANDLER)
  .action(async (path: string) => {
    let content = "";
    spinner.start("Reading spec");

    if (path.startsWith("0x") || path.endsWith(".eth")) {
      if (path.endsWith(".eth")) {
        spinner.text = "Resolving ENS name";
        const address = await resolveToAddress(path);

        if (!address) {
          throw new Error(`Cannot resolve ENS name "${path}"`);
        }

        path = address;
      }

      spinner.text = "Fetching Provider data";
      const provider = await indexerClient.getActorByIdOrAddress(
        path as Address
      );

      if (!provider) {
        throw new Error(`Provider ${path} not found`);
      }

      spinner.text = "Initializing Pipe";

      const pipe =
        config.pipe.value === "http"
          ? await createHTTPPipe()
          : await createXMTPPipe();
      const target =
        config.pipe.value === "http"
          ? provider.endpoint
          : checkValidationError(
              addressSchema.safeParse(path),
              "Operator Address"
            );

      spinner.text = "Waiting response";
      const res = await pipe.send(target, {
        method: PipeMethods.GET,
        path: "/spec",
        timeout: 20 * 1000, // 20 seconds
      });

      if (res.code != PipeResponseCodes.OK) {
        throw new Error(
          `Cannot get OpenAPI spec from the operator: ${res.body.message}`
        );
      }

      content = res.body;
    } else if (path.startsWith("https://") || path.startsWith("http://")) {
      const file = await fetch(path, {
        method: "GET",
        redirect: "follow",
      });
      content = await file.text();
    } else {
      const stat = statSync(path, { throwIfNoEntry: false });
      if (!stat || !stat.isFile()) {
        throw new Error(`File "${path}" not found`);
      }

      content = readFileSync(path, { encoding: "utf-8" }).toString();
    }

    spinner.text = "Parsing spec";
    const spec = await sm.parseSpec(content);

    spinner.text = "Importing spec";
    sm.importAPISpec(content, spec.command);
    spinner.succeed(green.bold("Done"));
  });
