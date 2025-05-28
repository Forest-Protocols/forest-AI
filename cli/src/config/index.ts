import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { Config } from "./config";
import { ConfigPath } from "./path";
import { red } from "ansis";
import { z } from "zod";
import {
  addressSchema,
  ForestChain,
  ForestRegistryAddress,
  ForestSlasherAddress,
  ForestTokenAddress,
  getContractAddressByChain,
  PrivateKeySchema,
  setGlobalRateLimit,
  setGlobalRateLimitTimeWindow,
  USDCAddress,
} from "@forest-protocols/sdk";
import { Address } from "viem";

// Load the configuration file
const path = ConfigPath.configFilePath;
let loadedConfig: Record<string, unknown> = {};
if (existsSync(path)) {
  const fileContent = readFileSync(path).toString();
  try {
    loadedConfig = JSON.parse(fileContent);

    // Be sure that it is a JSON object
    const parseResult = z
      .record(z.string(), z.unknown())
      .safeParse(loadedConfig);

    if (parseResult.error) {
      const error = parseResult.error.errors[0];
      throw new Error(error.message);
    }
  } catch (err: any) {
    // TODO: Should we continue with the default values when the file is not valid?
    console.error(red(`Invalid config.json file: ${err?.message || err}`));
    process.exit(1);
  }
}

export const rpcHost = new Config({
  name: "rpcHost",
  envName: "FOREST_RPC_HOST",
  schema: z.string(),
  defaultValue: "127.0.0.1:8545",
  value: loadedConfig.rpcHost,
});

export const chain = new Config<ForestChain>({
  name: "chain",
  envName: "FOREST_CHAIN",
  schema: z.enum(["anvil", "optimism", "optimism-sepolia", "base", "base-sepolia"], {
    message: `Should be one of: "anvil", "optimism", "optimism-sepolia", "base", "base-sepolia`,
  }),
  defaultValue: "anvil",
  value: loadedConfig.chain,
});

export const rateLimit = new Config<number>({
  name: "rateLimit",
  envName: "FOREST_RATE_LIMIT",
  schema: z.coerce.number().int(),
  defaultValue: 25,
  value: loadedConfig.rateLimit,
});
setGlobalRateLimit(rateLimit.value);

export const rateLimitTimeWindow = new Config<number>({
  name: "rateLimitTimeWindow",
  envName: "FOREST_RATE_LIMIT_TIME_WINDOW",
  schema: z.coerce.number().int(),
  defaultValue: 1000, // 1 second
  value: loadedConfig.rateLimitTimeWindow,
});
setGlobalRateLimitTimeWindow(rateLimitTimeWindow.value);

export const account = new Config<Address | undefined>({
  name: "account",
  envName: "FOREST_ACCOUNT",
  schema: z
    .string()
    .optional()
    .transform((value, ctx) => {
      // If the value is not defined, no need to further checking
      if (value === undefined) {
        return;
      }

      // If the given value is a path
      if (existsSync(value)) {
        value = readFileSync(value).toString().trim() as Address;
      }

      // If the value is not prefixed with `0x`
      if (!value.startsWith("0x")) {
        value = `0x${value}`;
      }

      // Apply the schema that defined for private keys
      const validation = PrivateKeySchema.safeParse(value);
      if (validation.error) {
        validation.error.issues.forEach((issue) => ctx.addIssue(issue));
        return z.NEVER;
      }

      return validation.data as Address;
    }),
  value: loadedConfig.account,
});

export const registryAddress = new Config<Address>({
  name: "registryAddress",
  envName: "FOREST_REGISTRY_ADDRESS",
  schema: addressSchema,
  defaultValue: getContractAddressByChain(chain.value, ForestRegistryAddress),
  value: loadedConfig.registryAddress,
});

export const slasherAddress = new Config<Address>({
  name: "slasherAddress",
  envName: "FOREST_SLASHER_ADDRESS",
  schema: addressSchema,
  defaultValue: getContractAddressByChain(chain.value, ForestSlasherAddress),
  value: loadedConfig.slasherAddress,
});

export const tokenAddress = new Config<Address>({
  name: "tokenAddress",
  envName: "FOREST_TOKEN_ADDRESS",
  schema: addressSchema,
  defaultValue: getContractAddressByChain(chain.value, ForestTokenAddress),
  value: loadedConfig.tokenAddress,
});

export const usdcAddress = new Config<Address>({
  name: "usdcAddress",
  envName: "FOREST_USDC_ADDRESS",
  schema: addressSchema,
  defaultValue: getContractAddressByChain(chain.value, USDCAddress),
  value: loadedConfig.usdcAddress,
});

/**
 * Saves the given name/value pair as a config to the config file
 */
export function saveConfig(name: string, value?: unknown) {
  if (!existsSync(ConfigPath.configDirPath)) {
    mkdirSync(ConfigPath.configDirPath, { recursive: true });
  }

  writeFileSync(
    ConfigPath.configFilePath,
    JSON.stringify(
      {
        ...loadedConfig,
        [name]: value,
      },
      null,
      2
    )
  );
}

export const config = {
  rpcHost,
  chain,
  rateLimit,
  rateLimitTimeWindow,
  account,
  registryAddress,
  slasherAddress,
  tokenAddress,
  usdcAddress,
};
