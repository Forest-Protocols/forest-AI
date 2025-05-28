import { ActorType } from "@forest-protocols/sdk";
import { providerCommand } from ".";
import { createUpdateDetailsCommand } from "../common/update-actor-details";

createUpdateDetailsCommand(providerCommand, ActorType.Provider);
