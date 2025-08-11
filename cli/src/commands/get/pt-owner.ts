import { ActorType } from "@forest-protocols/sdk";
import { getCommand } from ".";
import { createGetActorCommand } from "../common/get-actor";
import { formatAddress, resolveToName } from "@/utils/address";
import { magenta } from "ansis";

createGetActorCommand(getCommand, {
  actorType: ActorType.ProtocolOwner,
  aliases: ["pto", "pt-owners"],
  command: "pt-owner",
  async additionalLogs(actor) {
    let output = "";
    if (actor.ownedProtocols.length > 0) {
      output += "\nOwns the following Protocols:\n";
      output += magenta.bold(
        (
          await Promise.all(
            actor.ownedProtocols.map(async (protocol) => {
              // Resolve each of the registered Protocol addresses to ENS names if possible
              const ensName = await resolveToName(protocol.address);

              if (protocol.name) {
                return `${protocol.name} (${
                  ensName ? `${ensName}, ` : ""
                }${formatAddress(protocol.address)})`;
              }
              return protocol.address;
            })
          )
        ).join(", ")
      );
    }
    return output;
  },
});
