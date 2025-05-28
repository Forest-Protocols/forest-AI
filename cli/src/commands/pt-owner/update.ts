import { ActorType } from "@forest-protocols/sdk";
import { ptOwnerCommand } from ".";
import { createUpdateDetailsCommand } from "../common/update-actor-details";

createUpdateDetailsCommand(ptOwnerCommand, ActorType.ProtocolOwner);
