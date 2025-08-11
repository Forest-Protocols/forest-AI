import { ActorType, actorTypeToString, DECIMALS } from "@forest-protocols/sdk";
import { Command } from "commander";
import { OPTIONS } from "../options";
import { z } from "zod";
import { accountFileOrKeySchema } from "@/validation/account";
import { checkAndAskAllowance, createViemPublicClient } from "@/utils";
import { privateKeyToAccount } from "viem/accounts";
import { formatUnits } from "viem";
import { green } from "ansis";
import { spinner } from "@/program";
import { checkValidationError } from "@/validation/error-handling";
import {
  createProtocolInstance,
  createRegistryInstance,
  createSlasherInstance,
  createTokenInstance,
  indexerClient,
} from "@/client";
import { resolveENSName } from "@/utils/address";

export function createRegisterInPTCommand(
  parent: Command,
  actorType: ActorType
) {
  const actorTypeString = actorTypeToString(actorType);
  return parent
    .command("register-in")
    .description(`Registers in a Protocol as a ${actorTypeString}`)
    .option(
      OPTIONS.ACCOUNT.FLAGS,
      OPTIONS.ACCOUNT.DESCRIPTION,
      OPTIONS.ACCOUNT.HANDLER
    )
    .requiredOption(OPTIONS.PT_ADDRESS.FLAGS, OPTIONS.PT_ADDRESS.DESCRIPTION)
    .requiredOption(
      "--collateral <number>",
      `Initial collateral amount of the ${actorTypeString} in FOREST tokens. Must be higher than min collateral of the Protocol.`
    )
    .action(async (rawOptions: any) => {
      const options = checkValidationError(
        z
          .object({
            account: accountFileOrKeySchema,
            ptAddress: z.string(),
            collateral: z.coerce.number(),
          })
          .safeParse({
            account: rawOptions[OPTIONS.ACCOUNT.OPTION_NAME],
            ptAddress: rawOptions[OPTIONS.PT_ADDRESS.OPTION_NAME],
            collateral: rawOptions.collateral,
          })
      );

      const ptAddress = await resolveENSName(options.ptAddress);
      const client = createViemPublicClient();
      const account = privateKeyToAccount(options.account);
      const registry = createRegistryInstance(client, account);
      const token = createTokenInstance(client, account);
      const pt = createProtocolInstance(client, ptAddress, account);
      const slasher = createSlasherInstance(client);

      spinner.start("Checking Actor");
      const actor = await indexerClient.getActorByIdOrAddress(account.address);

      if (actor.type !== actorType) {
        throw new Error(`Account is not a ${actorTypeToString(actorType)}`);
      }

      spinner.text = "Checking fees and collateral";
      const [protocol, registryFee] = await Promise.all([
        indexerClient.getProtocolByAddress(ptAddress),
        indexerClient.getActorRegistrationFeeInProtocol(),
      ]);

      const minCollateral = BigInt(protocol.minCollateral);
      const ptFees = {
        provider: BigInt(protocol.providerRegistrationFee),
        validator: BigInt(protocol.validatorRegistrationFee),
        offer: BigInt(protocol.offerRegistrationFee),
      };

      const initialCollateral =
        BigInt(options.collateral) * BigInt(Math.pow(10, DECIMALS.FOREST));

      if (initialCollateral < minCollateral) {
        throw new Error(
          `Minimum collateral is ${formatUnits(
            minCollateral,
            DECIMALS.FOREST
          )} FOREST for this Protocol`
        );
      }

      spinner.text = "Checking costs and allowance";

      const [balance, allowanceRegistry, allowanceSlasher] = await Promise.all([
        token.getBalance(account.address),
        token.getAllowance(account.address, registry.address),
        token.getAllowance(account.address, slasher.address),
      ]);

      // Calculate the costs
      const feeOf = actorType === ActorType.Provider ? "provider" : "validator";
      const registryCost = registryFee + ptFees[feeOf];
      const totalCost = registryCost + initialCollateral;

      if (balance < totalCost) {
        throw new Error(
          `Your balance doesn't cover the costs: ${formatUnits(
            totalCost,
            DECIMALS.FOREST
          )} FOREST (sum of; Forest Registry fee: ${formatUnits(
            registryFee,
            DECIMALS.FOREST
          )} FOREST, PT registration fee: ${formatUnits(
            ptFees[feeOf],
            DECIMALS.FOREST
          )} FOREST and given collateral: ${formatUnits(
            initialCollateral,
            DECIMALS.FOREST
          )})`
        );
      }

      await checkAndAskAllowance(
        allowanceRegistry,
        registryCost,
        registry.address,
        (spender, amount) => token.setAllowance(spender, amount),
        "FOREST",
        DECIMALS.FOREST,
        "Forest Registry",
        "for registration fees"
      );
      await checkAndAskAllowance(
        allowanceSlasher,
        initialCollateral,
        slasher.address,
        (spender, amount) => token.setAllowance(spender, amount),
        "FOREST",
        DECIMALS.FOREST,
        "Forest Slasher",
        "for collateral"
      );

      spinner.start("Registering in the Protocol");
      await pt.registerActor(actorType, initialCollateral);

      spinner.succeed(
        green(`${actorTypeString} successfully registered in the Protocol!`)
      );
      console.log(green.bold(`Actor         : ${actorTypeString}`));
      console.log(green.bold(`Actor ID      : ${actor.id}`));
      console.log(green.bold(`PT Address    : ${pt.address!}`));
    });
}
