import {
  forestChainToViemChain,
  httpTransport,
  truncateAddress as sdkTruncateAddress,
  XMTPv3Pipe,
} from "@forest-protocols/sdk";
import { Address, createPublicClient, formatUnits, Hex } from "viem";
import { confirm } from "@inquirer/prompts";
import { blue, green, italic, yellow } from "ansis";
import { z } from "zod";
import { checkValidationError } from "./validation/error-handling";
import { program, spinner } from "./program";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { config } from "./config";
import { ConfigPath } from "./config/path";
import { join } from "path";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "fs";
import { resolveToName } from "./utils/address";

/**
 * Loads the default generated account. If not exists just generates a new one
 */
export function loadDefaultAccount() {
  const path = join(ConfigPath.configDirPath, "default-account");
  if (!existsSync(path)) {
    writeFileSync(path, generatePrivateKey(), { encoding: "utf-8" });
  }

  return readFileSync(path, { encoding: "utf-8" }).toString() as Hex;
}

/**
 * Creates an XMTP pipe with a private key or a random account.
 */
export async function createXMTPPipe(pk?: Hex) {
  if (pk === undefined) {
    pk = loadDefaultAccount();
  }

  // If the XMTP database directory doesn't exist, make it
  if (
    !statSync(ConfigPath.xmtpDirPath, { throwIfNoEntry: false })?.isDirectory()
  ) {
    mkdirSync(ConfigPath.xmtpDirPath, { recursive: true });
  }

  const account = privateKeyToAccount(pk);
  const pipe = new XMTPv3Pipe(pk, {
    // Use existing XMTP session/database if the account is not ephemeral
    encryptionKey: account.address,
    dbPath: join(ConfigPath.xmtpDirPath, `db-${account.address}.db`),
  });
  await pipe.init(config.chain.value == "optimism" ? "production" : "dev");

  return pipe;
}

/**
 * Creates a random EOA private key or uses the one that given as a config
 */
export function createAccount(options?: {
  /**
   * Uses the default randomly generated account
   */
  useDefault?: boolean;

  /**
   * Is that private key optional for the caller?
   * Then it won't throw error even if the account
   * config is not found or generated randomly
   */
  optional?: boolean;
}): Hex {
  let pk = config.account.value;

  if (pk === undefined && options?.useDefault === true) {
    pk = loadDefaultAccount();
  }

  // Account was mandatory but not found
  if (pk === undefined && options?.optional !== true) {
    throw new Error("No account option is given");
  }

  // Private key taken from config (from file, env or option)
  if (config.account.value !== undefined) {
    const isSpinning = spinner.isSpinning;
    spinner.stop();
    // Log additional information about where did we get this configuration
    switch (config.account.takenFrom) {
      case "env":
        console.log(
          blue.bold("INFO: Using the account defined as environment variable")
        );
        break;
      case "config":
        console.log(
          blue.bold("INFO: Using the account defined in the configuration")
        );
        break;
    }

    if (isSpinning) {
      spinner.start();
    }
  }

  return pk!;
}

/**
 * Creates a Viem public client based on the config.
 */
export function createViemPublicClient() {
  return createPublicClient({
    chain: forestChainToViemChain(config.chain.value),
    transport: httpTransport(config.chain.value, config.rpcHost.value),
  });
}

/**
 * Checks the allowance for the spender of a token and if it is not
 * enough, asks user to set it. If user rejects, throws an error.
 * @param allowance
 * @param amount
 * @param spender
 * @param setAllowance Allowance setter function
 * @param unit Unit of the currency
 * @param spinner
 * @param spenderName Visible name of the spender address in the message.
 * @param explain Reason for the allowance.
 */
export async function checkAndAskAllowance(
  allowance: bigint,
  amount: bigint,
  spender: Address,
  setAllowance: (spender: Address, amount: bigint) => Promise<any>,
  unit: string,
  decimals: number,
  spenderName?: string,
  explain?: string
) {
  if (allowance < amount) {
    spenderName = green.bold(spenderName || spender);
    explain = italic(explain ? `(${explain})` : "");
    const isSpinning = spinner.isSpinning;

    spinner.stop();
    console.log(
      yellow.bold(
        `Your account's spending allowance of ${blue.bold(
          unit
        )} token for ${spenderName} ${explain} is insufficient (current ${blue.bold(
          `${formatUnits(allowance, decimals)} ${unit}`
        )}).`
      )
    );

    if (!program.opts().yes) {
      const response = await confirm({
        message: yellow.bold(
          `Do you want to set your allowance to ${blue.bold(
            `${formatUnits(amount, decimals)} ${unit}`
          )} for ${spenderName}?`
        ),
        default: true,
      });

      if (!response) {
        throw new Error(`You have to set your allowance in order to continue`);
      }
    }

    spinner.start("Allowance TX is being sent to the blockchain");
    await setAllowance(spender, amount);
    await new Promise((res) => setTimeout(res, 5000));
    spinner.succeed(green("Allowance has been set successfully"));

    if (isSpinning) {
      spinner.start();
    }
  }
}

/**
 * Checks if `data` is a valid JSON content or not. If it is, tries to validate it via `schema`.
 */
export function validateIfJSON<T>(
  data: string,
  schema: z.Schema<T>,
  returnDataInFailure?: false
): T;
export function validateIfJSON<T>(
  data: string,
  schema: z.Schema<T>,
  returnDataInFailure: true
): string;
export function validateIfJSON<T>(
  data: string,
  schema: z.Schema<T>,
  returnDataInFailure?: boolean
) {
  let json = undefined;
  try {
    json = JSON.parse(data);
  } catch {
    /* Couldn't parsed the string */
  }
  if (json) {
    return checkValidationError(schema.safeParse(json));
  }

  if (returnDataInFailure) {
    return data;
  }
}

export async function truncateAddress(addr: Address) {
  const resolved = await resolveToName(addr);

  if (resolved) {
    return resolved;
  }

  if (program.opts().shortAddress) {
    return sdkTruncateAddress(addr);
  }
  return addr;
}
