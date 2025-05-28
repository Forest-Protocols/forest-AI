import { config, saveConfig } from "@/config/index";
import { configCommand } from ".";
import { red } from "ansis";

configCommand
  .command("set")
  .description("Sets a CLI config")
  .argument("<name>", "Configuration name")
  .argument(
    "[value]",
    "Value of the configuration. If it is empty, reverts the config to the default one"
  )
  .action(async (name: string, value?: string) => {
    const keys = Object.keys(config);
    const configName = keys.find((key) => key == name) as
      | keyof typeof config
      | undefined;

    if (!configName) {
      console.error(red(`Invalid config: "${name}"`));
      console.error(red(`Available configs are:\n${keys.join(", ")}`));
      process.exitCode = 1;
      return;
    }

    const field = config[configName];

    if (value !== undefined) {
      const result = field.validate(value);
      saveConfig(configName, result);
    } else {
      saveConfig(configName, undefined);
    }

    console.log("Configuration updated");
  });
