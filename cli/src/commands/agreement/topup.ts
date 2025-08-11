import { agreementCommand } from ".";
import { OPTIONS } from "../common/options";
import { checkValidationError } from "@/validation/error-handling";
import { z } from "zod";
import { DECIMALS, Status } from "@forest-protocols/sdk";
import { accountFileOrKeySchema } from "@/validation/account";
import { privateKeyToAccount } from "viem/accounts";
import { spinner } from "@/program";
import { green } from "ansis";
import { checkAndAskAllowance, createViemPublicClient } from "@/utils";
import { erc20Abi, formatUnits, getContract, parseUnits } from "viem";
import { config } from "@/config";
import { createProtocolInstance, indexerClient } from "@/client";
import { resolveENSName } from "@/utils/address";

agreementCommand
  .command("topup")
  .description("Adds more deposit to the given Agreement")
  .option(
    OPTIONS.ACCOUNT.FLAGS,
    OPTIONS.ACCOUNT.DESCRIPTION,
    OPTIONS.ACCOUNT.HANDLER
  )
  .requiredOption(OPTIONS.AGREEMENT_ID.FLAGS, OPTIONS.AGREEMENT_ID.DESCRIPTION)
  .requiredOption(OPTIONS.PT_ADDRESS.FLAGS, OPTIONS.PT_ADDRESS.DESCRIPTION)
  .requiredOption("--amount <number>", "Amount of USDC to be added")
  .action(async (rawOptions: any) => {
    const options = checkValidationError(
      z
        .object({
          ptAddress: z.string(),
          agreementId: z.coerce.number(),
          account: accountFileOrKeySchema,
          deposit: z.coerce.number(),
        })
        .safeParse({
          account: rawOptions[OPTIONS.ACCOUNT.OPTION_NAME],
          ptAddress: rawOptions[OPTIONS.PT_ADDRESS.OPTION_NAME],
          agreementId: rawOptions[OPTIONS.AGREEMENT_ID.OPTION_NAME],
          deposit: rawOptions.amount,
        })
    );

    const ptAddress = await resolveENSName(options.ptAddress);
    const account = privateKeyToAccount(options.account);
    const client = createViemPublicClient();
    const pt = createProtocolInstance(client, ptAddress, account);
    const usdc = getContract({
      abi: erc20Abi,
      address: config.usdcAddress.value,
      client,
    });

    spinner.start("Checking Agreement");
    const agreement = (
      await indexerClient.getAgreements({
        id: options.agreementId,
        protocolAddress: ptAddress,
        userAddress: account.address,
        status: Status.Active,
      })
    ).data[0];

    if (!agreement) {
      throw new Error(`Agreement ${options.agreementId} not found`);
    }

    spinner.text = "Checking balance and allowance";
    const deposit = parseUnits(options.deposit.toString(), DECIMALS.USDC);
    const [balance, pcAllowance] = await Promise.all([
      usdc.read.balanceOf([account.address]),
      usdc.read.allowance([account.address, pt.address!]),
    ]);

    if (balance < deposit) {
      throw new Error(
        `Balance is not enough (${formatUnits(
          balance,
          DECIMALS.USDC
        )} USDC); required: ${formatUnits(deposit, DECIMALS.USDC)} USDC`
      );
    }

    await checkAndAskAllowance(
      pcAllowance,
      deposit,
      pt.address!,
      (spender, amount) => usdc.write.approve([spender, amount], { account }),
      "USDC",
      DECIMALS.USDC,
      "Protocol",
      "for adding deposit"
    );

    spinner.text = "Adding deposit";
    await pt.topupAgreement(options.agreementId, deposit);

    spinner.succeed(
      green(
        `Deposit ${formatUnits(
          deposit,
          DECIMALS.USDC
        )} USDC added to Agreement ${options.agreementId} successfully`
      )
    );
  });
