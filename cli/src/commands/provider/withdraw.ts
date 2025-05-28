import { program, spinner } from "@/program";
import { providerCommand } from ".";
import { blue, green, yellow } from "ansis";
import { OPTIONS } from "../common/options";
import { checkValidationError } from "@/validation/error-handling";
import { z } from "zod";
import {
  addressSchema,
  Agreement,
  DECIMALS,
  Status,
} from "@forest-protocols/sdk";
import { accountFileOrKeySchema } from "@/validation/account";
import { privateKeyToAccount } from "viem/accounts";
import { createViemPublicClient } from "@/utils";
import { confirm } from "@inquirer/prompts";
import { formatUnits } from "viem";
import { createProtocolInstance } from "@/client";
import dayjs from "dayjs";

providerCommand
  .command("withdraw")
  .description(
    "Withdraws the earned amount of fee (in USDC) from (or all) an agreement(s)"
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
          ptAddress: addressSchema,
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
    const pt = createProtocolInstance(publicClient, options.ptAddress, account);

    let agreements: Agreement[] = [];

    spinner.start("Checking Agreements");

    if (options.agreementId === undefined) {
      agreements = await pt.getAllProviderAgreements(account.address);
    } else {
      agreements.push(await pt.getAgreement(options.agreementId));
    }
    agreements = agreements.filter(
      (agreement) => agreement.status === Status.Active
    );

    spinner.text = "Checking available fees";
    const fees = await Promise.all(
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
        )} USDC as of ${dayjs().format("DD MMMM YYYY")}`
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
