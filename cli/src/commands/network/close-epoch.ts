import { networkCommand } from ".";
import { OPTIONS } from "../common/options";
import { spinner } from "@/program";
import { green } from "ansis";
import { checkValidationError } from "@/validation/error-handling";
import { z } from "zod";
import { accountFileOrKeySchema } from "@/validation/account";
import { privateKeyToAccount } from "viem/accounts";
import { createViemPublicClient } from "@/utils";
import { createSlasherInstance, createTokenInstance } from "@/client";

networkCommand
  .command("close-epoch")
  .summary("Closes the currently processed Epoch and distributes the rewards")
  .description(
    "Closes the currently processed Epoch and distributes the rewards between all of the participants in the Network. It will be reverted if the Epoch is not over yet. 1 Epoch = 1 week."
  )
  .requiredOption(
    OPTIONS.ACCOUNT.FLAGS,
    OPTIONS.ACCOUNT.DESCRIPTION,
    OPTIONS.ACCOUNT.HANDLER
  )
  .option(
    "--epoch <block number>",
    "Uses the given block number as Epoch end block"
  )
  .option(
    "--no-reward",
    "Only closes the Epoch, doesn't distributes the rewards for the current Epoch"
  )
  .option(
    "--no-epoch",
    "Only distributes the rewards, doesn't close the current Epoch (assumes that it is already closed)"
  )
  .action(async (rawOptions: any) => {
    const options = checkValidationError(
      z
        .object({
          account: accountFileOrKeySchema,
          noReward: z.boolean().default(false),
          noEpoch: z.boolean().default(false),
          epoch: z.coerce.bigint().optional(),
        })
        .safeParse({
          account: rawOptions[OPTIONS.ACCOUNT.OPTION_NAME],
          noReward: rawOptions.noReward,
          noEpoch: rawOptions.noEpoch,
          epoch: rawOptions.epoch,
        })
    );

    const account = privateKeyToAccount(options.account);
    const client = createViemPublicClient();
    const slasher = createSlasherInstance(client, account);
    const token = createTokenInstance(client, account);

    spinner.start("Checking epoch");
    const endBlockNum =
      options.epoch || (await slasher.getCurrentEpochEndBlock());

    if (options.noEpoch !== true) {
      spinner.text = "Closing the Epoch";

      await slasher.closeEpoch();
      spinner.succeed(
        green(`Epoch closed successfully at block #${endBlockNum}`)
      );
    }

    if (options.noReward !== true) {
      spinner.text = "Distributing the rewards";
      await token.emitRewards(endBlockNum);

      spinner.succeed(green("Rewards distributed successfully"));
    }

    spinner.succeed(green("Done"));
  });
