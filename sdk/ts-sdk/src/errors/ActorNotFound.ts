import { Address } from "viem";

export class ActorNotFound extends Error {
  constructor(address: Address) {
    super(`Actor ${address} is not found in the protocol`);
    this.name = "ActorNotFound";
  }
}
