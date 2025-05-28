import { z } from "zod";
import { protocolCommand } from ".";
import { green } from "ansis";
import {
  ActorType,
  DECIMALS,
  generateCID,
  ProtocolDetailsSchema,
} from "@forest-protocols/sdk";
import { OPTIONS } from "../common/options";
import { accountFileOrKeySchema } from "@/validation/account";
import { privateKeyToAccount } from "viem/accounts";
import { formatUnits } from "viem";
import { fileSchema } from "@/validation/file";
import { checkValidationError } from "@/validation/error-handling";
import { spinner } from "@/program";
import {
  checkAndAskAllowance,
  createViemPublicClient,
  validateIfJSON,
} from "@/utils";
import { createRegistryInstance, createTokenInstance } from "@/client";

protocolCommand
  .command("create")
  .description("Creates a new Protocol in the Network")
  .option(
    OPTIONS.ACCOUNT.FLAGS,
    OPTIONS.ACCOUNT.DESCRIPTION,
    OPTIONS.ACCOUNT.HANDLER
  )
  .requiredOption(
    "--details <file>",
    "Detailed information about the Protocol."
  )
  .requiredOption(
    "--max-validator <number>",
    "Maximum validator count can register"
  )
  .requiredOption(
    "--max-provider <number>",
    "Maximum provider count can register"
  )
  .requiredOption(
    "--min-collateral <FOREST token amount>",
    "Minimum collateral amount for an actor (validator or provider) to register"
  )
  .requiredOption(
    "--validator-register-fee <FOREST token amount>",
    "Registration fee for the validators"
  )
  .requiredOption(
    "--provider-register-fee <FOREST token amount>",
    "Registration fee for the providers"
  )
  .requiredOption(
    "--offer-register-fee <FOREST token amount>",
    "Registration fee for the offers"
  )
  .requiredOption(
    "--term-update-delay <number>",
    "Minimum block count should pass after a provider makes an update on its terms"
  )
  .requiredOption(
    "--provider-share <number>",
    "The percentage of emission distribution amount that goes to the providers"
  )
  .requiredOption(
    "--validator-share <number>",
    "The percentage of emission distribution amount that goes to the validators"
  )
  .requiredOption(
    "--pto-share <number>",
    "The percentage of emission distribution amount that goes to the Protocol owner"
  )
  .action(async (rawOptions: any) => {
    const options = checkValidationError(
      z
        .object({
          maxValidator: z.coerce.number().nonnegative(),
          maxProvider: z.coerce.number().nonnegative(),
          minCollateral: z.coerce.bigint().positive(),
          validatorRegisterFee: z.coerce.bigint().positive(),
          providerRegisterFee: z.coerce.bigint().positive(),
          offerRegisterFee: z.coerce.bigint().positive(),
          termUpdateDelay: z.coerce.number().positive(),
          providerShare: z.coerce.number().min(1).max(100),
          validatorShare: z.coerce.number().min(1).max(100),
          ptoShare: z.coerce.number().min(1).max(100),
          account: accountFileOrKeySchema,
          details: fileSchema,
        })
        .safeParse({
          ...rawOptions,
          account: rawOptions[OPTIONS.ACCOUNT.OPTION_NAME],
        })
    );

    // Validate details if it is a JSON file
    validateIfJSON(options.details, ProtocolDetailsSchema);

    if (
      options.providerShare + options.ptoShare + options.validatorShare !=
      100
    ) {
      throw new Error(`Sum of the emissions sharing must be 100%`);
    }

    const account = privateKeyToAccount(options.account);
    const client = createViemPublicClient();
    const registry = createRegistryInstance(client, account);
    const token = createTokenInstance(client, account);

    spinner.start("Checking account");
    const actor = await registry.getActor(account.address);
    if (!actor) {
      throw new Error(
        `Account ${account.address} is not registered in the Network`
      );
    }

    if (actor.actorType != ActorType.ProtocolOwner) {
      throw new Error(`Account is not a Protocol Owner`);
    }

    spinner.text = "Checking fees, balance and allowance";
    const [ptRegFee, allowance, balance] = await Promise.all([
      registry.getPTRegistrationFee(),
      token.getAllowance(account.address, registry.address),
      token.getBalance(account.address),
    ]);

    if (balance < ptRegFee) {
      throw new Error(
        `Your balance (${formatUnits(
          balance,
          DECIMALS.FOREST
        )} FOREST) is not enough to register a new Protocol in the Network (${formatUnits(
          ptRegFee,
          DECIMALS.FOREST
        )} FOREST).`
      );
    }

    await checkAndAskAllowance(
      allowance,
      ptRegFee,
      registry.address,
      (spender, amount) => token.setAllowance(spender, amount),
      "FOREST",
      DECIMALS.FOREST,
      "Forest Registry",
      "for PC registration fee"
    );

    spinner.start(`Creating Protocol`);
    const exponent = BigInt(Math.pow(10, DECIMALS.FOREST));
    const cid = await generateCID(options.details);
    const ptAddress = await registry.createProtocol({
      maxProvider: options.maxProvider,
      maxValidator: options.maxValidator,
      minCollateral: options.minCollateral * exponent,
      offerRegistrationFee: options.offerRegisterFee * exponent,
      providerRegistrationFee: options.providerRegisterFee * exponent,
      validatorRegistrationFee: options.validatorRegisterFee * exponent,
      pcOwnerShare: options.ptoShare * 100,
      providerShare: options.providerShare * 100,
      validatorShare: options.validatorShare * 100,
      termUpdateDelay: options.termUpdateDelay,
      detailsLink: cid.toString(),
    });

    spinner.succeed(green.bold(`Protocol creation is completed!`));
    console.log(green.bold(`Address : ${ptAddress}`));
    console.log(green.bold(`CID     : ${cid.toString()}`));
  });
