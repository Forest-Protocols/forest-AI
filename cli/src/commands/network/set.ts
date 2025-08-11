import { z } from "zod";
import { networkCommand } from ".";
import { addressSchema, DECIMALS } from "@forest-protocols/sdk";
import { OPTIONS } from "../common/options";
import { accountFileOrKeySchema } from "@/validation/account";
import { createViemPublicClient } from "@/utils";
import { privateKeyToAccount } from "viem/accounts";
import { parseUnits } from "viem";
import { createRegistryInstance } from "@/client";
import { checkValidationError } from "@/validation/error-handling";
import { spinner } from "@/program";
import { green } from "ansis";
import { resolveENSName } from "@/utils/address";

networkCommand
  .command("set")
  .description("Updates the Network settings")
  .option(
    OPTIONS.ACCOUNT.FLAGS,
    OPTIONS.ACCOUNT.DESCRIPTION,
    OPTIONS.ACCOUNT.HANDLER
  )
  .option(
    "--in-pt-register-fee <amount of FOREST tokens>",
    "Updates the Actor registration fee in a Protocol."
  )
  .option(
    "--actor-register-fee <amount of FOREST tokens>",
    "Updates the Actor registration fee in the Network."
  )
  .option(
    "--burn-ratio <percentage>",
    "Updates the percentage of the burn ratio."
  )
  .option("--max-pt <count>", "Updates the maximum Protocol count")
  .option(
    "--pt-register-fee <amount of FOREST tokens>",
    "Updates the Protocol registration fee in the Network."
  )
  .option("--revenue-share <percentage>", "Updates the revenue share")
  .option("--treasury <address>", "Updates the treasury address.")
  .action(async (rawOptions: any) => {
    const options = checkValidationError(
      z
        .object({
          inPtRegisterFee: z.coerce.number().optional(),
          actorRegisterFee: z.coerce.number().optional(),
          ptRegisterFee: z.coerce.number().optional(),
          burnRatio: z.coerce.number().optional(),
          maxPt: z.coerce.number().optional(),
          revenueShare: z.coerce.number().optional(),
          treasury: addressSchema.optional(),
          account: accountFileOrKeySchema,
        })
        .safeParse({
          ...rawOptions,
          account: rawOptions[OPTIONS.ACCOUNT.OPTION_NAME],
        })
    );

    const {
      inPtRegisterFee,
      actorRegisterFee,
      ptRegisterFee,
      burnRatio,
      maxPt,
      revenueShare,
      account,
      treasury,
    } = options;

    const publicClient = createViemPublicClient();
    const acc = privateKeyToAccount(account);
    const registry = createRegistryInstance(publicClient, acc);

    if (inPtRegisterFee) {
      spinner.start("Updating actor registration fee in the Network");
      await registry.setActorInPTRegistrationFee(
        parseUnits(inPtRegisterFee.toString(), DECIMALS["FOREST"])
      );
      spinner.succeed(green("Actor registration fee is updated"));
    }

    if (burnRatio) {
      spinner.start("Updating burn ratio");
      await registry.setBurnRatio(BigInt(burnRatio * 100));
      spinner.succeed(green("Burn ratio is updated"));
    }

    if (ptRegisterFee) {
      spinner.start("Updating Protocol registration fee");
      await registry.setPTRegistrationFee(
        parseUnits(ptRegisterFee.toString(), DECIMALS["FOREST"])
      );
      spinner.succeed(green("Protocol registration fee is updated"));
    }

    if (revenueShare) {
      spinner.start("Updating revenue share");
      await registry.setRevenueShare(BigInt(revenueShare * 100));
      spinner.succeed(green("Revenue share is updated"));
    }

    if (actorRegisterFee) {
      spinner.start("Updating Actor registration fee");
      await registry.setActorInProtocolRegistrationFee(
        parseUnits(actorRegisterFee.toString(), DECIMALS["FOREST"])
      );
      spinner.succeed(green("Actor registration fee is updated"));
    }

    if (treasury) {
      spinner.start("Updating treasury address");
      await registry.setTreasuryAddress(await resolveENSName(treasury));
      spinner.succeed(green("Treasury address is updated"));
    }

    if (maxPt) {
      spinner.start("Updating maximum Protocol count");
      await registry.setMaxPTCount(BigInt(maxPt));
      spinner.succeed(green("Maximum Protocol count is updated"));
    }

    spinner.succeed(green("Done"));
  });
