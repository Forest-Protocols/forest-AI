import { agreementCommand } from ".";
import { OPTIONS } from "../common/options";
import { checkValidationError } from "@/validation/error-handling";
import { z } from "zod";
import { addressSchema, DECIMALS } from "@forest-protocols/sdk";
import { accountFileOrKeySchema } from "@/validation/account";
import { privateKeyToAccount } from "viem/accounts";
import { program, spinner } from "@/program";
import { green, red } from "ansis";
import { checkAndAskAllowance, createViemPublicClient } from "@/utils";
import { erc20Abi, formatUnits, getContract, parseUnits } from "viem";
import { config } from "@/config";
import { confirm } from "@inquirer/prompts";
import { createProtocolInstance } from "@/client";

agreementCommand
  .command("enter")
  .description(
    "Enters into an Agreement with a Provider in the given Protocol and Offer"
  )
  .option(
    OPTIONS.ACCOUNT.FLAGS,
    OPTIONS.ACCOUNT.DESCRIPTION,
    OPTIONS.ACCOUNT.HANDLER
  )
  .option(
    "--deposit <number>",
    "Amount of USDC for initial deposit of the agreement. It must cover minimum 2 months of fee. If it is not given uses 2 months of fee by default."
  )
  .requiredOption(OPTIONS.OFFER_ID.FLAGS, OPTIONS.OFFER_ID.DESCRIPTION)
  .requiredOption(OPTIONS.PT_ADDRESS.FLAGS, OPTIONS.PT_ADDRESS.DESCRIPTION)
  .action(async (rawOptions: any) => {
    const options = checkValidationError(
      z
        .object({
          ptAddress: addressSchema,
          offerId: z.coerce.number(),
          account: accountFileOrKeySchema,
          deposit: z.coerce.number().optional(),
        })
        .safeParse({
          account: rawOptions[OPTIONS.ACCOUNT.OPTION_NAME],
          ptAddress: rawOptions[OPTIONS.PT_ADDRESS.OPTION_NAME],
          offerId: rawOptions[OPTIONS.OFFER_ID.OPTION_NAME],
          deposit: rawOptions.deposit,
        })
    );

    const account = privateKeyToAccount(options.account);
    const client = createViemPublicClient();
    const pt = createProtocolInstance(client, options.ptAddress, account);
    const usdc = getContract({
      abi: erc20Abi,
      address: config.usdcAddress.value,
      client,
    });

    spinner.start("Checking Offer");
    const offer = await pt.getOffer(options.offerId);

    // If the initial deposit is not given, use two months of fee by default.
    const initialDeposit =
      options.deposit !== undefined
        ? parseUnits(options.deposit.toString(), DECIMALS.USDC)
        : offer.fee * 2n * 2635200n;

    spinner.stop();

    if (!program.opts().yes) {
      const response = await confirm({
        message: `Initial deposit of this Agreement is ${formatUnits(
          initialDeposit,
          DECIMALS.USDC
        )} USDC. Do you want to continue?`,
        default: true,
      });

      if (!response) {
        spinner.fail(red("Process canceled"));
        process.exitCode = 1;
        return;
      }
    }

    spinner.start("Checking balance and allowance");
    const [balance, providerAllowance] = await Promise.all([
      usdc.read.balanceOf([account.address]),
      usdc.read.allowance([account.address, pt.address!]),
    ]);

    if (balance < initialDeposit) {
      throw new Error(
        `Balance is not enough (${formatUnits(
          balance,
          DECIMALS.USDC
        )} USDC); required: ${formatUnits(initialDeposit, DECIMALS.USDC)} USDC`
      );
    }

    await checkAndAskAllowance(
      providerAllowance,
      initialDeposit,
      pt.address!,
      (spender, amount) =>
        usdc.write.approve([spender, amount], {
          account,
        }),
      "USDC",
      DECIMALS.USDC,
      "Protocol",
      "for initial deposit"
    );

    spinner.start("Entering to a new agreement");
    const agreementId = await pt.enterAgreement(offer.id, initialDeposit);

    spinner.succeed(
      green(
        `Entered to a new agreement (id: ${agreementId}) successfully with offer ${offer.id}`
      )
    );
  });
