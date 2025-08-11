import { program, spinner } from "@/program";
import { OPTIONS } from "../common/options";
import { checkValidationError } from "@/validation/error-handling";
import { z } from "zod";
import { accountFileOrKeySchema } from "@/validation/account";
import { PipeResponseCodes } from "@forest-protocols/sdk";
import { Command } from "commander";
import { createAccount, createXMTPPipe, createHTTPPipe } from "@/utils";
import { green, red, yellow } from "ansis";
import { sm, OASSchema } from "@/config/spec";
import { resolveENSName, resolveToName } from "@/utils/address";
import { config } from "@/config";
import { indexerClient } from "@/client";
import { Address } from "viem";

export const apiCommand = program
  .command("api")
  .description("Imports or executes Protocol APIs");

/**
 * Recursively resolves ENS names in an object
 * @param obj The object to process
 * @returns A new object with resolved ENS names
 */
async function resolveEnsNames(obj: any): Promise<any> {
  if (!obj) return obj;

  if (typeof obj === "string") {
    if (obj.endsWith(".eth")) {
      const resolved = await resolveToName(obj);
      return resolved || obj;
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return Promise.all(obj.map((item) => resolveEnsNames(item)));
  }

  if (typeof obj === "object") {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = await resolveEnsNames(value);
    }
    return result;
  }

  return obj;
}

export async function loadAndParseAPISpecs() {
  await sm.loadAPISpecs();

  for (const apiSpec of sm.apiSpecs) {
    const cmd = apiCommand
      .command(apiSpec.command)
      .description(apiSpec.description);

    // Define aliases if they are defined
    for (const alias of apiSpec.aliases || []) {
      cmd.alias(alias);
    }

    for (const endpoint of apiSpec.endpoints) {
      const endpointCmd = cmd
        .command(endpoint.command)
        .summary(endpoint.summary)
        .description(endpoint.description)
        .option(
          OPTIONS.ACCOUNT.FLAGS,
          `If it is given, will be used for XMTP communication. Otherwise uses a random generated account.`,
          OPTIONS.ACCOUNT.HANDLER
        )
        .option(
          OPTIONS.PIPE.FLAGS,
          OPTIONS.PIPE.DESCRIPTION,
          OPTIONS.PIPE.HANDLER
        )
        .option(OPTIONS.PIPE_ENDPOINT.FLAGS, OPTIONS.PIPE_ENDPOINT.DESCRIPTION)
        .option(
          "--operator <address>",
          "Address of the Operator if XMTP Pipe is used"
        );

      // For Provider endpoints we need to pass Provider ID, so in that
      // case define an additional required option.
      if (endpoint.isProviderEndpoint) {
        endpointCmd.requiredOption(
          "--provider-id <id>",
          "ID of the Provider that request goes to"
        );
      }

      let schema: OASSchema = {
        type: "object",
        properties: {},
        required: [],
      };
      let areOptionsRequired = false;

      if (endpoint.body?.content?.["application/json"].schema) {
        schema = endpoint.body.content?.["application/json"].schema;
        if (schema) {
          if (schema.type != "object") {
            // If the body is not defined as an object, inherit the description from
            // root body if the schema itself doesn't have a description.
            schema.description ??= endpoint.body!.description;

            // Interpret the body as a value (e.g array, number, string) not an object
          }

          areOptionsRequired = endpoint.body.required || false;

          defineOptions(endpointCmd, "body", areOptionsRequired, 0, schema);
        }
      } else if ((endpoint.params?.length || 0) > 0) {
        // Shape params schemas into body-schema so parser functions will be able to use it
        for (const param of endpoint.params!) {
          // TODO: Check where the param is (in query, in headers etc.)
          schema.properties![param.name] = {
            ...param.schema,
            description: param.description || param.name,
            summary: param.description || param.name,
          };

          if (param.required) {
            schema.required?.push(param.name);
          }
        }

        // NOTE: Params cannot be passed as a single value since they are key value pairs.
        defineOptions(endpointCmd, "params", false, 0, schema);
      }

      endpointCmd.action(async (rawOptions: any) => {
        const providerIdSchema = z.coerce.number();
        const options = checkValidationError(
          z
            .object({
              operatorAddress: z.string().optional(),
              endpoint: z.string().optional(),
              account: accountFileOrKeySchema.optional(),
              providerId: endpoint.isProviderEndpoint
                ? providerIdSchema
                : providerIdSchema.optional(),
            })
            .safeParse({
              operatorAddress: rawOptions.operator,
              account: rawOptions[OPTIONS.ACCOUNT.OPTION_NAME],
              providerId: rawOptions.providerId,
              endpoint: rawOptions[OPTIONS.PIPE_ENDPOINT.OPTION_NAME],
            })
        );

        if (config.pipe.value === "xmtp") {
          if (!options.operatorAddress) {
            throw new Error(
              "Operator address is required when XMTP Pipe is used"
            );
          }

          options.operatorAddress = await resolveENSName(
            options.operatorAddress!
          );
        }

        // Parse body and params from the given options
        rawOptions = buildObjectFromOptions(rawOptions);

        const body = parseOptions(
          rawOptions.body,
          "body",
          areOptionsRequired,
          schema
        );
        const params = parseOptions(rawOptions.params, "params", false, schema);

        // If Provider ID is given, place it into the params/body
        if (options.providerId) {
          if (params) {
            params.providerId = options.providerId;
          }

          if (body) {
            body.providerId = options.providerId;
          }
        }

        // Resolve any ENS names in body and params
        const resolvedBody = await resolveEnsNames(body);
        const resolvedParams = await resolveEnsNames(params);

        spinner.start("Initializing Pipe");
        const accountKey = createAccount({ useDefault: true });
        const pipe =
          config.pipe.value === "http"
            ? await createHTTPPipe(accountKey)
            : await createXMTPPipe(accountKey);

        // We assume that all the Actors that have the same Operator address also
        // have the same endpoint value. So we can simply pick one to get Operator endpoint
        const operatorEndpoint = await indexerClient
          .getActors({ operatorAddress: options.operatorAddress! as Address })
          .then((res) => res.data[0].endpoint);
        if (
          config.pipe.value === "http" &&
          !options.endpoint &&
          !operatorEndpoint
        ) {
          throw new Error("Endpoint is required when HTTP Pipe is used");
        }

        spinner.text = "Waiting response";
        const res = await pipe.send(
          config.pipe.value === "http"
            ? options.endpoint || operatorEndpoint
            : options.operatorAddress!,
          {
            method: endpoint.method,
            path: endpoint.path,
            body: resolvedBody,
            params: resolvedParams,
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
          console.log(JSON.stringify(res.body, null, 2));
        }
      });
    }
  }
}

/**
 * Creates a structured object based on the given options.
 * Parses dot notation (obj.field) into an actual object.
 * @param options
 */
function buildObjectFromOptions(options: any) {
  const structuredObject = { ...options };

  for (const [option, value] of Object.entries(structuredObject)) {
    // This is an object
    if (option.includes(".")) {
      const path = option.split(".");

      // Delete the option has dot notation
      delete structuredObject[option];

      // Convert dot notation into an actual object
      let currentObject = (structuredObject[path[0]] = {
        ...structuredObject[path[0]],
      });
      for (let i = 1; i < path.length; i++) {
        const fieldName = path[i];
        const innerField = path[i + 1];

        if (innerField) {
          currentObject[fieldName] = {
            ...(currentObject[fieldName] || {}),
          };
        } else {
          currentObject[fieldName] = value;
        }

        currentObject = currentObject[fieldName];
      }
    }
  }

  return {
    params: structuredObject?.params,
    body: structuredObject?.body,
  };
}

/**
 * Parses the data as options based on the given OAS schema.
 */
function parseOptions(
  data: any,
  fieldName: string,
  required: boolean,
  oasSchema?: OASSchema,
  path?: string
) {
  if (!oasSchema || (data === undefined && !required)) return;

  if (oasSchema.type == "number") {
    const schema = z.coerce.number();

    return checkValidationError(
      (!required ? schema.optional() : schema).safeParse(data),
      path
    );
  } else if (oasSchema.type == "string") {
    const schema = z.string().nonempty();

    return checkValidationError(
      (!required ? schema.optional() : schema).safeParse(data),
      path
    );
  } else if (oasSchema.type == "array") {
    // Parse arrays as JSON strings
    const schema = z.string().transform((value, ctx) => {
      let obj: any = {};
      try {
        obj = JSON.parse(value);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid JSON object for ${fieldName}`,
        });
        return z.NEVER;
      }

      return obj;
    });

    return checkValidationError(
      (!required ? schema.optional() : schema).safeParse(data),
      path
    );
  }

  const fields: Record<string, any> = {};
  for (const [innerField, schema] of Object.entries(
    oasSchema.properties || {}
  )) {
    required = oasSchema.required?.find((r) => r == innerField) !== undefined;
    path = path ? `${path}.${innerField}` : innerField;

    fields[innerField] = parseOptions(
      data?.[innerField],
      innerField,
      required,
      schema,
      path
    );
  }
  return fields;
}

/**
 * Defines CLI option flags recursively based on the given OAS schema.
 */
function defineOptions(
  cmd: Command,
  optionName: string,
  required: boolean,
  depth = 0,
  oasSchema?: OASSchema,
  parentName?: string
) {
  if (!oasSchema) return;

  const option = required ? "requiredOption" : "option";

  if (["string", "number", "array", "boolean"].includes(oasSchema.type)) {
    const fullOptionName = `${parentName ? `${parentName}.` : ""}${optionName}`;
    const description =
      oasSchema.summary || oasSchema.description || optionName;

    let valueText = "";

    switch (oasSchema.type) {
      case "array":
        valueText = "JSON array string";
        break;
      case "number":
        valueText = "number";
        break;
      case "string":
        valueText = "string";
        break;
      case "boolean":
        valueText = "true or false";
        break;
    }

    cmd[option](
      `--${fullOptionName} <${valueText}>`,
      `${description} [${required ? "REQUIRED" : "OPTIONAL"}]`
    );

    return;
  }

  for (const [fieldName, schema] of Object.entries(
    oasSchema.properties || {}
  )) {
    required = oasSchema.required?.find((r) => r == fieldName) !== undefined;

    defineOptions(
      cmd,
      fieldName,
      required,
      depth + 1,
      schema,
      `${parentName ? `${parentName}.` : ""}${optionName}`

      // If object field is not the root one (body), use parent name
      // otherwise leave it as empty.
      // depth > 0
      //   ? `${parentName ? `${parentName}.` : ""}${optionName}`
      //   : undefined
    );
  }
}
