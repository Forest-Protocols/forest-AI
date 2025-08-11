import { agreementCommand } from ".";
import { OPTIONS } from "../common/options";
import { checkValidationError } from "@/validation/error-handling";
import { z } from "zod";
import { DECIMALS, IndexerAgreement, Status } from "@forest-protocols/sdk";
import { accountFileOrKeySchema } from "@/validation/account";
import { privateKeyToAccount } from "viem/accounts";
import { spinner } from "@/program";
import { formatUnits } from "viem";
import { indexerClient } from "@/client";
import { blue, cyanBright, green, magentaBright, yellow } from "ansis";
import { DateTime } from "luxon";
import { resolveENSName, resolveToName } from "@/utils/address";

type ExtendedAgreement = IndexerAgreement & {
  ensProviderAddress?: Promise<string | undefined>;
  ensUserAddress?: Promise<string | undefined>;
};

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
          ptAddress: z.string(),
          account: accountFileOrKeySchema,
          closed: z.boolean().default(false),
        })
        .safeParse({
          account: rawOptions[OPTIONS.ACCOUNT.OPTION_NAME],
          ptAddress: rawOptions[OPTIONS.PT_ADDRESS.OPTION_NAME],
          closed: rawOptions.closed,
        })
    );

    const ptAddress = await resolveENSName(options.ptAddress);

    spinner.start("Checking agreements");
    const account = privateKeyToAccount(options.account);
    const agreements: ExtendedAgreement[] = await indexerClient
      .getAgreements({
        protocolAddress: ptAddress,
        userAddress: account.address,
        status: options.closed ? Status.NotActive : Status.Active,
        limit: 100,
        autoPaginate: true,
      })
      .then((res) =>
        res.data.map((agreement) => ({
          ...agreement,
          ensProviderAddress: resolveToName(agreement.providerAddress),
          ensUserAddress: resolveToName(agreement.userAddress),
        }))
      );

    // Wait for all ENS addresses to be resolved
    spinner.text = "Resolving ENS addresses";
    await Promise.all(
      agreements.map((agreement) =>
        Promise.all([agreement.ensProviderAddress, agreement.ensUserAddress])
      )
    );

    spinner.stop();
    console.log();

    const dateFormat = "DD HH:mm:ss";
    for (let i = 0; i < agreements.length; i++) {
      const agreement = agreements[i];

      console.log(`~ Agreement ${agreement.id} ~`);

      const [ensProviderAddress, ensUserAddress] = await Promise.all([
        agreement.ensProviderAddress,
        agreement.ensUserAddress,
      ]);

      const lines = [
        [blue("Offer ID"), agreement.offerId],
        [
          yellow("Provider Address"),
          ensProviderAddress
            ? `${ensProviderAddress} (${agreement.providerAddress})`
            : agreement.providerAddress,
        ],
        [
          yellow("Owner Address"),
          ensUserAddress
            ? `${ensUserAddress} (${agreement.userAddress})`
            : agreement.userAddress,
        ],
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
          `$${formatUnits(BigInt(agreement.balance), DECIMALS.USDC)}`,
        ],
        [
          magentaBright("Entered At"),
          DateTime.fromISO(agreement.startTs).toFormat(dateFormat),
        ],
        [
          magentaBright("Closed At"),
          agreement.endTs === null
            ? "Not yet"
            : DateTime.fromISO(agreement.endTs).toFormat(dateFormat),
        ],
      ];

      for (const line of lines) {
        console.log(`${line[0]}: ${line[1]}`);
      }
      console.log();
    }
  });
