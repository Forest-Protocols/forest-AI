import { providerCommand } from ".";
import { ActorType } from "@forest-protocols/sdk";
import { createRegisterInPTCommand } from "../common/registration/in-pt";

createRegisterInPTCommand(providerCommand, ActorType.Provider);
