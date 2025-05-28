import { readFileSync, statSync } from "fs";
import { apiCommand } from ".";
import { spinner } from "@/program";
import { green } from "ansis";
import { createXMTPPipe } from "@/utils";
import { checkValidationError } from "@/validation/error-handling";
import {
  addressSchema,
  PipeMethod,
  PipeResponseCode,
} from "@forest-protocols/sdk";
import { sm } from "@/config/spec";
import { resolveToAddress } from "@/utils/address";

apiCommand
  .command("import")
  .summary("Imports OpenAPI spec of a Provider")
  .description("Imports OpenAPI spec of a Provider from a URL or local path")
  .argument(
    "<path or URL or Operator Address>",
    "Path, URL or the Operator Address that has the OpenAPI spec"
  )
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

      spinner.text = "Initializing XMTP";
      const pipe = await createXMTPPipe();
      const operatorAddress = checkValidationError(
        addressSchema.safeParse(path),
        "Operator Address"
      );

      spinner.text = "Waiting response";
      const res = await pipe.send(operatorAddress, {
        method: PipeMethod.GET,
        path: "/spec",
        timeout: 20 * 1000, // 20 seconds
      });

      if (res.code != PipeResponseCode.OK) {
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
