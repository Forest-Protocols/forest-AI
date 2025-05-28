import { walletCommand } from ".";
import { blue, green, magentaBright } from "ansis";
import { checkValidationError } from "@/validation/error-handling";
import { z } from "zod";
import { addressSchema, DECIMALS } from "@forest-protocols/sdk";
import { createViemPublicClient } from "@/utils";
import { erc20Abi, formatEther, formatUnits, getContract } from "viem";
import { config } from "@/config";
import { createTokenInstance } from "@/client";
import { spinner } from "@/program";
import { privateKeyToAccount } from "viem/accounts";

walletCommand
  .command("balance")
  .description(
    "Shows how much USDC, ETH and FOREST token the given account has"
  )
  .argument(
    "[address]",
    "Wallet address. If not provided, uses the given account if there is."
  )
  .action(async (address: string) => {
    const args = checkValidationError(
      z
        .object({
          address: addressSchema.optional(),
        })
        .safeParse({ address })
    );

    const client = createViemPublicClient();
    const token = createTokenInstance(client);
    const usdc = getContract({
      abi: erc20Abi,
      address: config.usdcAddress.value,
      client,
    });

    spinner.start("Getting balance");

    if (!args.address) {
      if (!config.account.value) {
        throw new Error("No wallet address or account provided");
      }

      const account = privateKeyToAccount(config.account.value);
      args.address = account.address;
    }

    const forestBalance = await token.getBalance(args.address, true);
    const ethBalance = await client.getBalance({ address: args.address });
    const usdcBalance = await usdc.read.balanceOf([args.address]);

    spinner.stop();
    console.log(`Account has:`);
    console.log(magentaBright.bold(`${formatEther(ethBalance)} ETH`));
    console.log(blue.bold(`${formatUnits(usdcBalance, DECIMALS.USDC)} USDC`));
    console.log(green.bold(`${forestBalance} FOREST`));
  });
