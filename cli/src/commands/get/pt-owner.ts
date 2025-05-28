import { ActorType } from "@forest-protocols/sdk";
import { getCommand } from ".";
import { createGetActorCommand } from "../common/get-actor";
import { resolveToName } from "@/utils/address";
import { magenta } from "ansis";

createGetActorCommand(getCommand, {
  actorType: ActorType.ProtocolOwner,
  aliases: ["pto", "pt-owners"],
  command: "pt-owner",
  async fetchAllActors(registry) {
    const protocols = await registry.getAllProtocols();
    const ownerAddresses = await Promise.all(
      protocols.map((protocol) => protocol.getOwnerAddress())
    );
    const owners = await Promise.all(
      ownerAddresses.map((owner) => registry.getActor(owner))
    );

    return owners.filter((owner) => owner !== undefined);
  },
  async fetchMoreActorInfo(registry, actor) {
    const protocols = await registry.getAllProtocols();
    const ownedProtocols = await Promise.all(
      protocols.map(async (protocol) => {
        const ownerAddress = await protocol.getOwnerAddress();
        if (ownerAddress.toLowerCase() === actor.ownerAddr.toLowerCase()) {
          return {
            address: protocol.address,
            ensName: await resolveToName(protocol.address),
          };
        }
        return null;
      })
    );

    return {
      ...actor,
      ownedProtocols: ownedProtocols.filter((p) => p !== null),
    };
  },
  async printHandler(actor) {
    if (actor.ownedProtocols.length > 0) {
      console.log("\nOwns the following Protocols:");
      console.log(
        magenta.bold(
          actor.ownedProtocols
            .map((protocol) => protocol.ensName || protocol.address)
            .join(", ")
        )
      );
    }
  },
});
