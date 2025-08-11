import { z } from "zod";
import { providerCommand } from ".";
import {
  ActorType,
  DECIMALS,
  generateCID,
  OfferDetailsSchema,
} from "@forest-protocols/sdk";
import { spinner } from "@/program";
import { formatUnits } from "viem";
import { OPTIONS } from "../common/options";
import { accountFileOrKeySchema } from "@/validation/account";
import { privateKeyToAccount } from "viem/accounts";
import { green } from "ansis";
import { checkValidationError } from "@/validation/error-handling";
import {
  checkAndAskAllowance,
  createViemPublicClient,
  validateIfJSON,
} from "@/utils";
import { fileSchema } from "@/validation/file";
import {
  createProtocolInstance,
  createRegistryInstance,
  createTokenInstance,
  indexerClient,
} from "@/client";
import { resolveENSName } from "@/utils/address";

providerCommand
  .command("register-offer")
  .description("Registers an Offer into a Protocol")
  .option(
    OPTIONS.ACCOUNT.FLAGS,
    OPTIONS.ACCOUNT.DESCRIPTION,
    OPTIONS.ACCOUNT.HANDLER
  )
  .requiredOption(OPTIONS.PT_ADDRESS.FLAGS, OPTIONS.PT_ADDRESS.DESCRIPTION)
  .requiredOption("--details <file>", "Detailed information about the Offer.")
  .requiredOption(
    "--fee <amount>",
    "Non-exponent per second price of the offer. 1 unit is approximately 2.60 USDC per month"
  )
  .requiredOption("--stock <amount>", "Stock amount of the offer")
  .action(async (rawOptions: any) => {
    const options = checkValidationError(
      z
        .object({
          ptAddress: z.string(),
          account: accountFileOrKeySchema,
          fee: z.coerce.bigint().positive(),
          stock: z.coerce.number().positive(),
          details: fileSchema,
        })
        .safeParse({
          ...rawOptions,
          ptAddress: rawOptions[OPTIONS.PT_ADDRESS.OPTION_NAME],
          account: rawOptions[OPTIONS.ACCOUNT.OPTION_NAME],
        })
    );

    const client = createViemPublicClient();
    const account = privateKeyToAccount(options.account);
    const registry = createRegistryInstance(client, account);
    const token = createTokenInstance(client, account);
    const ptAddress = await resolveENSName(options.ptAddress);
    const pt = createProtocolInstance(client, ptAddress, account);

    // Validate Offer details if it is a JSON file, otherwise skip validation
    validateIfJSON(options.details, OfferDetailsSchema);

    spinner.start("Checking account");
    const provider = await indexerClient.getActorByIdOrAddress(account.address);

    if (provider.type != ActorType.Provider) {
      throw new Error(`Actor is not a Provider`);
    }

    const providerIds = await indexerClient
      .getProtocolActors(ptAddress)
      .then((actors) =>
        actors
          .filter((actor) => actor.actorType === ActorType.Provider)
          .map((actor) => actor.actorId)
      );
    const providerId = providerIds.find((id) => id == provider.id);
    if (!providerId) {
      throw new Error(`Provider is not registered in this Protocol`);
    }

    spinner.text = "Checking fees";
    const protocol = await indexerClient.getProtocolByAddress(ptAddress);
    const [registryOfferRegistrationFee, pcFees] = await Promise.all([
      indexerClient.getRegistryInfo().then((info) => info.offerRegistrationFee),
      Promise.resolve({
        provider: BigInt(protocol.providerRegistrationFee),
        validator: BigInt(protocol.validatorRegistrationFee),
        offer: BigInt(protocol.offerRegistrationFee),
      }),
    ]);

    spinner.text = "Checking balance and allowance";
    const [balance, allowanceRegistry] = await Promise.all([
      token.getBalance(account.address),
      token.getAllowance(account.address, registry.address),
    ]);
    const totalCost = registryOfferRegistrationFee + pcFees.offer;

    if (balance < totalCost) {
      throw new Error(
        `Your balance doesn't cover the costs: ${formatUnits(
          totalCost,
          DECIMALS.FOREST
        )} FOREST (sum of Forest Registry fee: ${formatUnits(
          registryOfferRegistrationFee,
          DECIMALS.FOREST
        )} FOREST, PT Offer registration fee: ${formatUnits(
          pcFees.offer,
          DECIMALS.FOREST
        )} FOREST)`
      );
    }

    await checkAndAskAllowance(
      allowanceRegistry,
      totalCost,
      registry.address,
      (spender, amount) => token.setAllowance(spender, amount),
      "FOREST",
      DECIMALS.FOREST,
      "Forest Registry",
      "for registration fees"
    );

    spinner.start("Registering Offer in the Protocol");

    // Calculate CID of the file content, not the parsed JSON (if it is a JSON file)
    const cid = await generateCID(options.details);
    const offerId = await pt.registerOffer({
      providerOwnerAddress: account.address,
      detailsLink: cid.toString(),
      fee: options.fee,
      stockAmount: options.stock,
    });

    spinner.succeed(
      green(`Offer ${offerId} successfully registered in the Protocol!`)
    );
    console.log(green.bold(`PT Address   : ${options.ptAddress}`));
    console.log(green.bold(`PROV Address : ${account.address}`));
    console.log(green.bold(`PROV ID      : ${providerId}`));
    console.log(green.bold(`Offer ID     : ${offerId}`));
    console.log(green.bold(`Offer CID    : ${cid.toString()}`));
  });
