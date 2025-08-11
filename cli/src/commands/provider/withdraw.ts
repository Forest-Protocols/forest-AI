import { program, spinner } from "@/program";
import { providerCommand } from ".";
import { blue, green, yellow } from "ansis";
import { OPTIONS } from "../common/options";
import { checkValidationError } from "@/validation/error-handling";
import { z } from "zod";
import { DECIMALS, IndexerAgreement, Status } from "@forest-protocols/sdk";
import { accountFileOrKeySchema } from "@/validation/account";
import { privateKeyToAccount } from "viem/accounts";
import { createViemPublicClient } from "@/utils";
import { confirm } from "@inquirer/prompts";
import { Address, formatUnits } from "viem";
import { createProtocolInstance, indexerClient } from "@/client";
import { DateTime } from "luxon";
import { resolveENSName } from "@/utils/address";

providerCommand
  .command("withdraw")
  .description(
    "Withdraws the earned amount of fee (in USDC) from one or all of the agreements"
  )
  .option(
    OPTIONS.ACCOUNT.FLAGS,
    OPTIONS.ACCOUNT.DESCRIPTION,
    OPTIONS.ACCOUNT.HANDLER
  )
  .option(
    OPTIONS.AGREEMENT_ID.FLAGS,
    "Agreement ID. If not given, tries to withdraw from all of the agreements"
  )
  .requiredOption(OPTIONS.PT_ADDRESS.FLAGS, OPTIONS.PT_ADDRESS.DESCRIPTION)
  .action(async (rawOptions: any) => {
    const options = checkValidationError(
      z
        .object({
          ptAddress: z.string(),
          agreementId: z.coerce.number().optional(),
          account: accountFileOrKeySchema,
        })
        .safeParse({
          account: rawOptions[OPTIONS.ACCOUNT.OPTION_NAME],
          ptAddress: rawOptions[OPTIONS.PT_ADDRESS.OPTION_NAME],
          agreementId: rawOptions[OPTIONS.AGREEMENT_ID.OPTION_NAME],
        })
    );

    const account = privateKeyToAccount(options.account);
    const publicClient = createViemPublicClient();
    const ptAddress = await resolveENSName(options.ptAddress);
    const pt = createProtocolInstance(publicClient, ptAddress, account);

    let agreements: IndexerAgreement[] = [];

    spinner.start("Getting Agreements");

    if (options.agreementId === undefined) {
      agreements = await indexerClient
        .getAgreements({
          providerAddress: account.address.toLowerCase() as Address,
          protocolAddress: ptAddress.toLowerCase() as Address,
          limit: 100,
          status: Status.Active,
          autoPaginate: true,
        })
        .then((res) => res.data);
    } else {
      agreements = await indexerClient
        .getAgreements({
          id: options.agreementId,
          protocolAddress: ptAddress.toLowerCase() as Address,
          providerAddress: account.address.toLowerCase() as Address,
          status: Status.Active,
        })
        .then((res) => res.data);
    }

    spinner.text = "Checking available fees";
    const fees = await Promise.all(
      // TODO: Can we manage this value via indexer?
      agreements.map((agreement) => pt.getReward(agreement.id))
    );
    const totalFee = fees.reduce((acc, val) => acc + val, 0n);

    if (totalFee == 0n) {
      spinner.stop();
      console.error(yellow.bold(`There are no fees available yet`));
      process.exitCode = 1;
      return;
    }

    spinner.stop();
    console.log(
      blue.bold(
        `Your total fee for ${
          options.agreementId === undefined
            ? "all of the Agreements in this Protocol"
            : "the given Agreement"
        } is ${formatUnits(
          totalFee,
          DECIMALS.USDC
        )} USDC as of ${DateTime.now().toFormat("DD MMMM YYYY")}`
      )
    );

    if (!program.opts().yes) {
      const response = await confirm({
        message: "Do you want to withdraw this amount now?",
        default: true,
      });

      if (!response) {
        spinner.warn(yellow.bold("Operation cancelled"));
        process.exitCode = 1;
        return;
      }
    }

    for (const agreement of agreements) {
      spinner.start(yellow(`Withdrawing fee from Agreement #${agreement.id}`));
      await pt.withdrawReward(agreement.id);
      spinner.succeed(
        green(`Withdraw successful for Agreement ${agreement.id}`)
      );
    }

    spinner.succeed(green("Done"));
  });
