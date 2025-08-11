import { ActorType } from "@forest-protocols/sdk";
import { getCommand } from ".";
import {
  createGetActorCommand,
  providerAndValidatorAdditionalLogs,
} from "../common/get-actor";

createGetActorCommand(getCommand, {
  actorType: ActorType.Validator,
  aliases: ["val", "vals", "validators"],
  command: "validator",
  additionalLogs: providerAndValidatorAdditionalLogs,
});
