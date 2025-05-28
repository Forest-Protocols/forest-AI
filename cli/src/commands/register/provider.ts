import { registerCommand } from ".";
import { ActorType } from "@forest-protocols/sdk";
import { createRegisterActorCommand } from "../common/registration/in-network";

createRegisterActorCommand(
  registerCommand
    .command("provider")
    .alias("prov")
    .description("Registers a new Provider in the Network"),
  ActorType.Provider
);
