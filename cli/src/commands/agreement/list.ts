import { agreementCommand } from ".";
import { OPTIONS } from "../common/options";
import { checkValidationError } from "@/validation/error-handling";
import { z } from "zod";
import { addressSchema, DECIMALS, Status } from "@forest-protocols/sdk";
import { accountFileOrKeySchema } from "@/validation/account";
import { privateKeyToAccount } from "viem/accounts";
import { spinner } from "@/program";
import { createViemPublicClient, truncateAddress } from "@/utils";
import { formatUnits } from "viem";
import { createProtocolInstance } from "@/client";
import { blue, cyanBright, green, magentaBright, yellow } from "ansis";
import dayjs from "dayjs";

agreementCommand
  .command("list")
  .alias("ls")
  .description("Lists all of the entered Agreements in the given Protocol")
  .option("-c, --closed", "Lists closed agreements")
  .option(
    OPTIONS.ACCOUNT.FLAGS,
    OPTIONS.ACCOUNT.DESCRIPTION,
    OPTIONS.ACCOUNT.HANDLER
  )
  .requiredOption(OPTIONS.PT_ADDRESS.FLAGS, OPTIONS.PT_ADDRESS.DESCRIPTION)
  .action(async (rawOptions: any) => {
    const options = checkValidationError(
      z
        .object({
          ptAddress: addressSchema,
          account: accountFileOrKeySchema,
          closed: z.boolean().default(false),
        })
        .safeParse({
          account: rawOptions[OPTIONS.ACCOUNT.OPTION_NAME],
          ptAddress: rawOptions[OPTIONS.PT_ADDRESS.OPTION_NAME],
          closed: rawOptions.closed,
        })
    );
    const account = privateKeyToAccount(options.account);
    const client = createViemPublicClient();
    const pt = createProtocolInstance(client, options.ptAddress, account);

    spinner.start("Checking agreements");
    const rawAgreements = await pt.getAllUserAgreements(account.address);
    let agreements = await Promise.all(
      rawAgreements.map(async (rawAgreement) => ({
        ...rawAgreement,
        remainingBalance: await pt.getRemainingAgreementBalance(
          rawAgreement.id
        ),
        offer: await pt.getOffer(rawAgreement.offerId),
      }))
    );
    spinner.stop();

    if (options.closed !== true) {
      agreements = agreements.filter(
        (agreement) => agreement.status === Status.Active
      );
    }

    // Sort to make active agreements first
    agreements.sort((a, b) =>
      a.status === b.status ? 0 : a.status == Status.Active ? -1 : 1
    );

    const dateFormat = "DD MMMM YYYY HH:mm";
    for (let i = 0; i < agreements.length; i++) {
      const agreement = agreements[i];

      console.log(`\n----- Agreement - ${agreement.id} -----`);

      const lines = [
        [blue("Offer ID"), agreement.offerId],
        [
          yellow("Provider Address"),
          await truncateAddress(agreement.offer.ownerAddr),
        ],
        [yellow("Owner Address"), await truncateAddress(account.address)],

        [
          cyanBright("Status"),
          {
            [Status.Active]: "Active",
            [Status.NotActive]: "Closed",
            [Status.None]: "None",
          }[agreement.status],
        ],
        [
          green("Remaining Balance"),
          `$${formatUnits(agreement.remainingBalance, DECIMALS.USDC)}`,
        ],
        [
          magentaBright("Entered At"),
          dayjs.unix(Number(agreement.startTs)).format(dateFormat),
        ],
        [
          magentaBright("Closed At"),
          agreement.endTs == 0n
            ? "-"
            : dayjs.unix(Number(agreement.endTs)).format(dateFormat),
        ],
      ];

      for (const line of lines) {
        console.log(`${line[0]}: ${line[1]}`);
      }
    }
  });
