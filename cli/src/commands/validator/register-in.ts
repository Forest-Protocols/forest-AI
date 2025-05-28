import { ActorType } from "@forest-protocols/sdk";
import { createRegisterInPTCommand } from "../common/registration/in-pt";
import { validatorCommand } from ".";

createRegisterInPTCommand(validatorCommand, ActorType.Validator);
