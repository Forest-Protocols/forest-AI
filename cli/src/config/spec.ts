import { z } from "zod";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { yellow } from "ansis";
import { PipeMethod } from "@forest-protocols/sdk";
import OASNormalize from "oas-normalize";
import { checkValidationError } from "../validation/error-handling";
import { ConfigPath } from "./path";
import { join } from "path";

export type OASSchema = {
  type: "number" | "object" | "string" | "array" | "boolean";
  properties?: Record<string, OASSchema>;
  required?: string[];
  description?: string;
  summary?: string;
  items?: OASSchema;
};

type MethodInfo = {
  "x-forest-provider-endpoint"?: any;
  summary?: string;
  description?: string;
  parameters?: APIParam[];
  requestBody?: APIBody;
};

export type APIParam = {
  name: string;
  in: "query" | string;
  description?: string;
  schema: OASSchema;
  required?: boolean;
};

export type APIBody = {
  required?: boolean;
  description?: string;
  content?: {
    "application/json": {
      schema: OASSchema;
    };
  };
};

export type APIEndpoint = {
  path: string;
  command: string;
  summary: string;
  description: string;
  isProviderEndpoint: boolean;
  method: PipeMethod;

  body?: APIBody;
  params?: APIParam[];
};

export type APISpec = {
  command: string;
  description: string;
  aliases?: string[];
  endpoints: APIEndpoint[];
};

export class SpecManager {
  /**
   * Loaded API specifications
   */
  apiSpecs: APISpec[] = [];

  constructor() {}

  /**
   * Saves the given content into the `specs` directory.
   * Doesn't validate the spec file.
   */
  importAPISpec(content: string, fileName: string) {
    const path = ConfigPath.apiSpecDirPath;
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
    }

    writeFileSync(join(path, fileName), content);
  }

  /**
   * Parses a OpenAPI spec content and returns an usable APISpec.
   */
  async parseSpec(specContent: string): Promise<APISpec> {
    const spec = new OASNormalize(specContent);

    // Do the base OAS validation
    await spec.validate();

    // Parse spec
    const bundle = (await spec.bundle()) as Record<string, any>;

    // Extract CLI specific data and validate
    const info = checkValidationError(
      z
        .object({
          "x-forest-cli-aliases": z
            .array(z.string({ message: "Only strings are allowed" }), {
              message: "Aliases has to be defined as a string array",
            })
            .optional(),
          "x-forest-cli-command": z
            .string({
              message: '"info.x-forest-cli-command" must be a string',
            })
            .nonempty({
              message: '"x-forest-cli-command" cannot be empty',
            }),
        })
        .safeParse(bundle.info)
    );
    const description =
      bundle.info.description || bundle.info.title || `${info} API`;

    const endpoints: APIEndpoint[] = [];

    // Loop over all of the paths
    for (const [path, methods] of Object.entries<any>(bundle.paths)) {
      const pathCommand = path.substring(1);
      const methodKeys = Object.keys(methods);

      // Loop over all of the methods
      for (const [method, info] of Object.entries<MethodInfo>(methods)) {
        // If there are more than one method for this path,
        // add that method as a suffix to the command (e.g "resources-get", "resources-post").
        // Otherwise just use the path name itself (e.g "resources")
        const methodSuffix =
          methodKeys.length > 1 ? `-${method.toLowerCase()}` : "";
        const command = `${pathCommand}${methodSuffix}`;
        const pipeMethod = PipeMethod[method.toUpperCase() as PipeMethod];

        if (!pipeMethod) {
          throw new Error(`Unknown method "${method}" for ${path}`);
        }

        endpoints.push({
          path,
          command,
          description: info.description || command,
          summary: info.summary || info.description || command,
          isProviderEndpoint: info["x-forest-provider-endpoint"] !== undefined,
          method: pipeMethod,
          body: info.requestBody,
          params: info.parameters,
        });
      }
    }

    return {
      command: info["x-forest-cli-command"],
      aliases: info["x-forest-cli-aliases"],
      description,
      endpoints,
    };
  }

  /**
   * Parses and loads the given specs globally in the program.
   * If the specs are not given, loads them from the default spec
   * directory.
   */
  async loadAPISpecs(specs?: string[]) {
    if (!existsSync(ConfigPath.apiSpecDirPath)) {
      mkdirSync(ConfigPath.apiSpecDirPath, { recursive: true });
      return;
    }

    if (!specs) {
      const specFiles = readdirSync(ConfigPath.apiSpecDirPath, {
        recursive: true,
      });
      specs = specFiles.map((specFile) => {
        const path = join(
          ConfigPath.apiSpecDirPath,
          specFile.toString("utf-8")
        );

        return readFileSync(path, { encoding: "utf-8" });
      });
    }

    for (const specContent of specs) {
      try {
        this.apiSpecs.push(await this.parseSpec(specContent));
      } catch (err: any) {
        console.error(
          yellow.bold(
            `WARNING: API spec file "${specContent}" couldn't load: ${err?.message}`
          )
        );
      }
    }
  }
}

export const sm = new SpecManager();
