import {
  Address,
  createPublicClient,
  getContract,
  http,
  PublicClient,
  encodePacked,
  keccak256,
  namehash,
} from "viem";
import { base, mainnet } from "viem/chains";
import { normalize } from "viem/ens";
import { L2ResolverAbi } from "@/abi/l2resolver";
import { ADDRESS_ZERO, sleep } from "@forest-protocols/sdk";
import { program } from "@/program";
import { truncateAddress as sdkTruncateAddress } from "@forest-protocols/sdk";

export const BASENAME_L2_RESOLVER_ADDRESS =
  "0xC6d566A56A1aFf6508b41f6c90ff131615583BCD";

const resolverClient = createPublicClient({
  chain: base,
  transport: http("https://base-rpc.publicnode.com"),
});

export const addressNameResolutions: Record<string, string> = {};
export const nameAddressResolutions: Record<string, string> = {};

export function formatAddress(address: Address | string) {
  if (program.opts().shortAddress) {
    return sdkTruncateAddress(address as Address);
  }
  return address;
}

/**
 * Resolves the given name to an address.
 */
export async function resolveToAddress(
  name: string
): Promise<Address | undefined> {
  // Return the cached one if we already have it.
  if (nameAddressResolutions[name]) {
    return nameAddressResolutions[name] as Address;
  }

  const resolver = getContract({
    address: BASENAME_L2_RESOLVER_ADDRESS,
    abi: L2ResolverAbi,
    client: resolverClient,
  });

  const node = namehash(normalize(name));
  const address = await rpcRequest(() => resolver.read.addr([node]));

  if (!address || address === ADDRESS_ZERO) {
    nameAddressResolutions[name] = name;
    return;
  }

  // Cache those address/name resolutions
  addressNameResolutions[address] = name;
  nameAddressResolutions[name] = address;

  return address;
}

/**
 * Resolves the given address to a name
 */
export async function resolveToName(
  address: string
): Promise<string | undefined> {
  if (addressNameResolutions[address]) {
    return addressNameResolutions[address] as Address;
  }

  const name = await rpcRequest(() =>
    getBasename(address as Address, resolverClient)
  );

  if (!name) {
    addressNameResolutions[address] = address;
    return;
  }

  // Cache those address/name resolutions
  addressNameResolutions[address] = name;
  nameAddressResolutions[name] = address;

  return name;
}

export async function resolveToNames(addresses: string[]) {
  return await Promise.all(addresses.map((address) => resolveToName(address)));
}

export type Basename = `${string}.base.eth`;

/**
 * Convert an chainId to a coinType hex for reverse chain resolution
 */
export const convertChainIdToCoinType = (chainId: number): string => {
  // L1 resolvers to addr
  if (chainId === mainnet.id) {
    return "addr";
  }

  const coinType = (0x80000000 | chainId) >>> 0;
  return coinType.toString(16).toLocaleUpperCase();
};

/**
 * Convert an address to a reverse node for ENS resolution
 */
export const convertReverseNodeToBytes = (
  address: Address,
  chainId: number
) => {
  const addressFormatted = address.toLocaleLowerCase() as Address;
  const addressNode = keccak256(addressFormatted.substring(2) as Address);
  const chainCoinType = convertChainIdToCoinType(chainId);
  const baseReverseNode = namehash(
    `${chainCoinType.toLocaleUpperCase()}.reverse`
  );
  const addressReverseNode = keccak256(
    encodePacked(["bytes32", "bytes32"], [baseReverseNode, addressNode])
  );
  return addressReverseNode;
};

export async function getBasename(
  address: Address,
  client: PublicClient<any, any, any>
) {
  try {
    const addressReverseNode = convertReverseNodeToBytes(address, base.id);
    const basename = await client.readContract({
      abi: L2ResolverAbi,
      address: BASENAME_L2_RESOLVER_ADDRESS,
      functionName: "name",
      args: [addressReverseNode],
    });
    if (basename) {
      return basename as Basename;
    }
  } catch {
    return;
  }
}

const rateLimit = {
  maxRequests: 5,
  timeWindow: 2000,
  timestamps: [] as number[],
};

// Helper function to wait for local rate limit
async function waitForRateLimit() {
  const now = Date.now();
  rateLimit.timestamps = rateLimit.timestamps.filter(
    (ts) => now - ts < rateLimit.timeWindow
  );

  if (rateLimit.timestamps.length >= rateLimit.maxRequests) {
    const oldestTimestamp = rateLimit.timestamps[0];
    const waitTime = rateLimit.timeWindow - (now - oldestTimestamp);
    await sleep(waitTime);
    return waitForRateLimit();
  }

  rateLimit.timestamps.push(now);
}

async function rpcRequest<T>(fn: () => Promise<T>): Promise<T> {
  await waitForRateLimit();
  return await fn();
}
