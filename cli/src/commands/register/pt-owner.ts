import { registerCommand } from ".";
import { ActorType } from "@forest-protocols/sdk";
import { createRegisterActorCommand } from "../common/registration/in-network";

createRegisterActorCommand(
  registerCommand
    .command("pt-owner")
    .aliases(["pto", "protocol-owner"])
    .description("Registers a new Protocol Owner in the Network"),
  ActorType.ProtocolOwner
);
