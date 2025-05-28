import { z } from "zod";
import { protocolCommand } from ".";
import { addressSchema, DECIMALS } from "@forest-protocols/sdk";
import { checkValidationError } from "@/validation/error-handling";
import { OPTIONS } from "../common/options";
import { accountFileOrKeySchema } from "@/validation/account";
import { createViemPublicClient } from "@/utils";
import { createProtocolInstance } from "@/client";
import { privateKeyToAccount } from "viem/accounts";
import { spinner } from "@/program";
import { green } from "ansis";
import { parseUnits } from "viem";

protocolCommand
  .command("set")
  .description("Updates settings of a Protocol")
  .requiredOption(OPTIONS.PT_ADDRESS.FLAGS, OPTIONS.PT_ADDRESS.DESCRIPTION)
  .option(
    OPTIONS.ACCOUNT.FLAGS,
    OPTIONS.ACCOUNT.DESCRIPTION,
    OPTIONS.ACCOUNT.HANDLER
  )
  .option("--details-link <CID>", "Updates the details CID of the Protocol")
  .option(
    "--share-provider <percentage>",
    "Updates the emission share of the Provider. --share-validator and --share-pt-owner also must be given."
  )
  .option(
    "--share-validator <percentage>",
    "Updates the emission share of the Validator. --share-provider and --share-pt-owner also must be given."
  )
  .option(
    "--share-pt-owner <percentage>",
    "Updates the emission share of the Protocol Owner. --share-validator and --share-provider also must be given."
  )
  .option("--max-providers <count>", "Updates the maximum Provider count")
  .option("--max-validators <count>", "Updates the maximum Validator count")
  .option(
    "--min-collateral <amount of FOREST token>",
    "Updates the minimum collateral amount to register in this Protocol"
  )
  .option(
    "--owner <address>",
    "Updates/transfers the ownership of the Protocol to the given address."
  )
  .option("--term-update-delay <block count>", "Updates the term update delay.")
  .option(
    "--provider-reg-fee <fee>",
    "Updates the registration fee for Providers"
  )
  .option(
    "--validator-reg-fee <fee>",
    "Updates the registration fee for Validators"
  )
  .option("--offer-reg-fee <fee>", "Updates new offer registration fee")
  .action(async (rawOptions: any) => {
    const options = checkValidationError(
      z
        .object({
          ptAddress: addressSchema,

          detailsLink: z.string().optional(),

          shareProvider: z.coerce.number().optional(),
          shareValidator: z.coerce.number().optional(),
          sharePtOwner: z.coerce.number().optional(),

          maxProviders: z.coerce.number().optional(),
          maxValidators: z.coerce.number().optional(),
          minCollateral: z.coerce.number().optional(),
          owner: addressSchema.optional(),
          termUpdateDelay: z.coerce.bigint().optional(),

          providerRegFee: z.coerce.number().optional(),
          validatorRegFee: z.coerce.number().optional(),
          offerRegFee: z.coerce.number().optional(),

          account: accountFileOrKeySchema,
        })
        .safeParse({
          ...rawOptions,
          ptAddress: rawOptions[OPTIONS.PT_ADDRESS.OPTION_NAME],
          account: rawOptions[OPTIONS.ACCOUNT.OPTION_NAME],
        })
    );

    const account = privateKeyToAccount(options.account);
    const client = createViemPublicClient();
    const pt = createProtocolInstance(client, options.ptAddress, account);

    if (options.detailsLink) {
      spinner.start("Updating details link");
      await pt.setDetailsLink(options.detailsLink);
      spinner.succeed(green("Details link updated"));
    }

    if (options.maxProviders || options.maxValidators) {
      spinner.start(`Updating maximum actor count`);
      let currentCounts: any = undefined;

      // If not both of them are given, we need to take the current value of the other one
      if (!options.maxProviders || !options.maxValidators) {
        currentCounts = await pt.getMaxActors();
      }

      await pt.setMaxActors({
        provider: options.maxProviders || currentCounts?.provider,
        validator: options.maxValidators || currentCounts?.validator,
      });

      spinner.succeed(green("Maximum actor count updated"));
    }

    if (options.minCollateral) {
      spinner.start("Updating minimum collateral");
      await pt.setMinCollateral(
        parseUnits(options.minCollateral.toString(), DECIMALS.FOREST)
      );

      spinner.succeed(green("Minimum collateral updated"));
    }

    if (
      options.providerRegFee ||
      options.offerRegFee ||
      options.validatorRegFee
    ) {
      spinner.start("Updating registration fees");
      let currentFees: any = undefined;

      if (
        !options.providerRegFee ||
        !options.offerRegFee ||
        !options.validatorRegFee
      ) {
        currentFees = await pt.getRegistrationFees();
      }

      await pt.setRegistrationFees({
        provider: options.providerRegFee || currentFees?.provider,
        validator: options.validatorRegFee || currentFees?.validator,
        offer: options.offerRegFee || currentFees?.offer,
      });

      spinner.succeed(green("Registration fees updated"));
    }

    if (options.owner) {
      spinner.start("Updating owner");
      await pt.setOwner(options.owner);

      spinner.succeed(green("Owner updated"));
    }

    if (
      options.sharePtOwner ||
      options.shareProvider ||
      options.shareValidator
    ) {
      spinner.start("Updating emission sharing");
      if (
        !options.sharePtOwner ||
        !options.shareProvider ||
        !options.shareValidator
      ) {
        throw new Error(`You need to set all of the emission share together`);
      }

      if (
        options.sharePtOwner + options.shareProvider + options.shareValidator !=
        100
      ) {
        throw new Error(`Sum of the emission shares must be up to 100`);
      }

      await pt.setEmissionShares({
        provider: options.shareProvider * 100,
        validator: options.shareValidator * 100,
        pcOwner: options.sharePtOwner * 100,
      });

      spinner.succeed(green("Emission sharing updated"));
    }

    if (options.termUpdateDelay) {
      spinner.start("Updating term update delay");
      await pt.setTermUpdateDelay(options.termUpdateDelay);

      spinner.succeed(green("Term update delay updated"));
    }

    spinner.succeed(green("Done"));
  });
