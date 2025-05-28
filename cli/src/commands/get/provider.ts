import { ActorType } from "@forest-protocols/sdk";
import { getCommand } from ".";
import { createGetActorCommand } from "../common/get-actor";
import { magenta } from "ansis";
import { resolveToName } from "@/utils/address";

createGetActorCommand(getCommand, {
  actorType: ActorType.Provider,
  aliases: ["prov", "provs", "providers"],
  command: "provider",
  fetchAllActors(registry) {
    return registry.getAllProviders();
  },
  async fetchMoreActorInfo(registry, actor) {
    const protocolAddresses = await registry.getRegisteredPTsOfProvider(
      actor.id
    );

    return {
      ...actor,
      protocolsAddresses: await Promise.all(
        protocolAddresses.map(async (address) => ({
          address,
          ensName: await resolveToName(address),
        }))
      ),
    };
  },
  async printHandler(actor) {
    if (actor.protocolsAddresses.length > 0) {
      console.log("\nRegistered in the following Protocols:");
      console.log(
        magenta.bold(
          actor.protocolsAddresses
            .map((protocol) => protocol.ensName || protocol.address)
            .join(", ")
        )
      );
    }
  },
});
