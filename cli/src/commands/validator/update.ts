import { ActorType } from "@forest-protocols/sdk";
import { validatorCommand } from ".";
import { createUpdateDetailsCommand } from "../common/update-actor-details";

createUpdateDetailsCommand(validatorCommand, ActorType.Validator);
