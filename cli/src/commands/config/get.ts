import { config } from "@/config/index";
import { configCommand } from ".";
import { blue, cyanBright, magentaBright, red, yellow } from "ansis";
import { Config } from "@/config/config";

configCommand
  .command("get")
  .description("Get a CLI config")
  .argument(
    "[config-name]",
    "Configuration name. If not given, shows the whole config."
  )
  .action(async (name?: string) => {
    if (name === undefined) {
      for (const [name, field] of Object.entries(config)) {
        console.log(
          `${name.padEnd(20)} = ${field.value} (${colorizeTakenFrom(
            field.takenFrom
          )})`
        );
      }
      return;
    }

    const field = config[name as keyof typeof config];
    if (field === undefined) {
      console.error(red(`config "${name}" doesn't exist`));
      console.error(
        red(`Available configs are:\n${Object.keys(config).join(", ")}`)
      );
      process.exitCode = 1;
      return;
    }
    console.log(
      `${name.padEnd(25)} = ${field.value} (${colorizeTakenFrom(
        field.takenFrom
      )})`
    );
  });

function colorizeTakenFrom(value: Config["takenFrom"]) {
  switch (value) {
    case "config":
      return yellow(value);
    case "option":
      return magentaBright(value);
    case "env":
      return blue(value);
    case "default":
      return cyanBright(value);
  }
}
