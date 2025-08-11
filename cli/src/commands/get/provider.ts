import { ActorType } from "@forest-protocols/sdk";
import { getCommand } from ".";
import {
  createGetActorCommand,
  providerAndValidatorAdditionalLogs,
} from "../common/get-actor";

createGetActorCommand(getCommand, {
  actorType: ActorType.Provider,
  aliases: ["prov", "provs", "providers"],
  command: "provider",
  additionalLogs: providerAndValidatorAdditionalLogs,
});
