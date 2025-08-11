import { getContract } from "viem";
import { validatorCommand } from ".";
import { OPTIONS } from "../common/options";
import { checkValidationError } from "@/validation/error-handling";
import { z } from "zod";
import { accountFileOrKeySchema } from "@/validation/account";
import { privateKeyToAccount } from "viem/accounts";
import { green } from "ansis";
import { spinner } from "@/program";
import { createViemPublicClient } from "@/utils";
import { SlasherABI } from "@forest-protocols/sdk";
import { jsonOrFileSchema } from "@/validation/json-file";
import { createSlasherInstance } from "@/client";
import { resolveENSName } from "@/utils/address";

validatorCommand
  .command("commit")
  .description("Commits the Provider scores for a given Protocol")
  .option(
    OPTIONS.ACCOUNT.FLAGS,
    OPTIONS.ACCOUNT.DESCRIPTION,
    OPTIONS.ACCOUNT.HANDLER
  )
  .requiredOption(OPTIONS.PT_ADDRESS.FLAGS, OPTIONS.PT_ADDRESS.DESCRIPTION)
  .requiredOption(
    "--scores <JSON or file>",
    "JSON file (or content) that contains Provider scores. See docs for more."
  )
  .option(
    "--validator-address <address>",
    "Address of the Validator. If not provided, uses the account address as the Validator address"
  )
  .action(async (rawOptions: any) => {
    const options = checkValidationError(
      z
        .object({
          ptAddress: z.string(),
          account: accountFileOrKeySchema,
          validatorAddress: z.string().optional(),
          scoreDefinitions: jsonOrFileSchema(
            z.array(
              z.object({
                provId: z.coerce.number(),
                score: z.coerce.bigint(),
                agreementId: z.coerce.number(),
              })
            )
          ),
        })
        .safeParse({
          account: rawOptions[OPTIONS.ACCOUNT.OPTION_NAME],
          ptAddress: rawOptions[OPTIONS.PT_ADDRESS.OPTION_NAME],
          scoreDefinitions: rawOptions.scores,
          validatorAddress: rawOptions.validatorAddress,
        })
    );

    const account = privateKeyToAccount(options.account);
    const client = createViemPublicClient();
    const slasher = createSlasherInstance(client, account);
    const slasherContract = getContract({
      abi: SlasherABI,
      address: slasher.address,
      client,
    });

    spinner.start("Computing hash of the given definitions");
    const hash = await slasherContract.read.computeHash([
      options.scoreDefinitions,
    ]);

    spinner.succeed(green(`Hash of the given Provider scores: ${hash}`));

    spinner.start("Committing to the blockchain");
    await slasher.commitResult(
      hash,
      options.validatorAddress
        ? await resolveENSName(options.validatorAddress)
        : account.address,
      await resolveENSName(options.ptAddress)
    );
    spinner.succeed(green(`Provider scores committed. Hash: ${hash}`));
  });
