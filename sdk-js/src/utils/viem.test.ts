import { anvil, optimismSepolia} from "viem/chains";
import { httpTransport } from "./viem";
import { expect, test, describe } from "vitest";

describe("HTTP Transport", () => {
  test("Anvil chain protocol should be HTTP even it is given as HTTPS", () => {
    const transport = httpTransport(anvil, "https://127.0.0.1:8545");
    expect(transport({ chain: anvil }).value?.url).toBe(
      "http://127.0.0.1:8545"
    );
  });

  test("Anvil chain protocol should be HTTP even it isn't given", () => {
    const transport = httpTransport(anvil, "127.0.0.1:8545");
    expect(transport({ chain: anvil }).value?.url).toBe(
      "http://127.0.0.1:8545"
    );
  });

  test("OP Sepolia chain protocol should be HTTPS even it isn't given", () => {
    const transport = httpTransport(
      optimismSepolia,
      "optimism-sepolia-rpc.publicnode.com"
    );
    expect(transport({ chain: optimismSepolia }).value?.url).toBe(
      "https://optimism-sepolia-rpc.publicnode.com"
    );
  });

  test("OP Sepolia chain protocol should be HTTP even it is given as HTTP", () => {
    const transport = httpTransport(
      optimismSepolia,
      "http://optimism-sepolia-rpc.publicnode.com"
    );
    expect(transport({ chain: optimismSepolia }).value?.url).toBe(
      "https://optimism-sepolia-rpc.publicnode.com"
    );
  });

  test("OP Sepolia URL path should be included (with http)", () => {
    const transport = httpTransport(
      optimismSepolia,
      "http://optimism-sepolia-rpc.publicnode.com/supersecretapikeypart"
    );
    expect(transport({ chain: optimismSepolia }).value?.url).toBe(
      "https://optimism-sepolia-rpc.publicnode.com/supersecretapikeypart"
    );
  });

  test("OP Sepolia URL path should be included (without protocol part)", () => {
    const transport = httpTransport(
      optimismSepolia,
      "optimism-sepolia-rpc.publicnode.com/supersecretapikeypart"
    );
    expect(transport({ chain: optimismSepolia }).value?.url).toBe(
      "https://optimism-sepolia-rpc.publicnode.com/supersecretapikeypart"
    );
  });
});
