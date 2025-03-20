import { ForestChain } from "@/types";
import { http } from "viem";

/**
 * Creates Viem HTTP transport based on the given chain and host.
 */
export function httpTransport(chain: ForestChain, host: string) {
  return http(`${chain == "anvil" ? "http" : "https"}://${host}`);
}
