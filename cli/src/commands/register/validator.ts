import { registerCommand } from ".";
import { ActorType } from "@forest-protocols/sdk";
import { createRegisterActorCommand } from "../common/registration/in-network";

createRegisterActorCommand(
  registerCommand
    .command("validator")
    .alias("val")
    .description("Registers a new Validator in the Network"),
  ActorType.Validator
);
