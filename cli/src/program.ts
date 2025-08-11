import { Command } from "commander";
import ora from "ora";
import { VERSION } from "./version";
import { config } from "./config";
import { red } from "ansis";

export const spinner = ora({
  discardStdin: false,
  hideCursor: false,
});
export const program = new Command("forest");

program.configureHelp({
  optionTerm(option) {
    return option.flags;
  },
  subcommandTerm(cmd) {
    return cmd.name();
  },
  commandUsage(cmd) {
    const usage: string[] = [];
    for (let parent = cmd.parent; parent; parent = parent.parent) {
      usage.push(parent.name());
    }
    usage.reverse();
    if (usage.length === 0) {
      return `${cmd.name()} ${cmd.usage()}`;
    }

    return `${usage.join(" ")} ${cmd.name()} ${cmd.usage()}`;
  },
});

program.configureOutput({
  // Output in red color for errors
  outputError: (str, write) => write(red(str)),
});

program
  .description("CLI tool to interact with Forest Protocols")
  .version(VERSION)
  .usage("[options] <command>")
  .option(
    "-y, --yes",
    "Assumes that all the questions will be answered with 'Yes'"
  )
  .option("-s, --short-address", "Makes all of the address outputs shorter")
  .option(
    "--rpc <rpc host>",
    "Uses the given RPC endpoint for the blockchain communication",
    /**
     * We cannot get parsed options unless we call "program.parse()"
     * and that call executes the action handlers. So as a solution
     * we use "option parser" functions to load corresponding option
     * value to the configuration via `load()` method.
     */
    (value) => config.rpcHost.load(value, "option") // Load the option value to the configuration
  )
  .option(
    "--chain <chain name>",
    "Uses the given blockchain, possible values are: anvil, optimism-sepolia, optimism, , base, base-sepolia",
    (value) => config.chain.load(value, "option")
  )
  .option(
    "--registry <address>",
    "Uses the given address for Forest Registry smart contract",
    (value) => config.registryAddress.load(value, "option")
  )
  .option(
    "--token <address>",
    "Uses the given address for Forest Token smart contract",
    (value) => config.tokenAddress.load(value, "option")
  )
  .option(
    "--slasher <address>",
    "Uses the given address for Forest Slasher smart contract",
    (value) => config.slasherAddress.load(value, "option")
  )
  .option(
    "--usdc <address>",
    "Uses the given address for USDC smart contract",
    (value) => config.usdcAddress.load(value, "option")
  )
  .action(() => program.help());
