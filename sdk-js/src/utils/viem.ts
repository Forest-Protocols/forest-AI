import { TerminationError, TimeoutError } from "@/errors";
import { throttleRequest } from "@/throttle";
import { ForestChain, MaybePromise } from "@/types";
import {
  Abi,
  Chain,
  Client,
  Hex,
  http,
  TransactionNotFoundError,
  TransactionReceipt,
  TransactionReceiptNotFoundError,
  WriteContractParameters,
} from "viem";
import {
  getTransactionReceipt,
  writeContract as viemWriteContract,
} from "viem/actions";
import { anvil } from "viem/chains";
import { sleep } from "./sleep";

/**
 * Creates Viem HTTP transport based on the given chain and host.
 */
export function httpTransport(
  chain: Chain | ForestChain,
  host: string,
  signal?: AbortSignal
) {
  let isAnvil = false;
  if (
    (typeof chain !== "string" && chain.id === anvil.id) || // Chain
    chain === "anvil" // ForestChain
  ) {
    isAnvil = true;
  }

  const protocol = isAnvil ? "http" : "https";
  let url: URL;

  // Check if the given host has a protocol
  if (!/^https?:\/\//i.test(host)) {
    url = new URL("http://" + host); // Prepend default protocol
  } else {
    url = new URL(host);
  }

  return http(
    `${protocol}://${url.host}${url.pathname === "/" ? "" : url.pathname}`,
    {
      onFetchRequest() {
        // NOTE: Generally if viem library had a support for abort signals,
        // we wouldn't need to do that. So we cannot cancel a request on the fly
        // but we can block new ones if abort signal is received.

        // Check abort signal before every request
        if (signal?.aborted) {
          throw new TerminationError();
        }
      },
    }
  );
}

/**
 * Writes contract request and waits until it is included in a block (1 confirmation)
 */
export async function writeContract<T extends Abi>(
  client: Client,
  request: WriteContractParameters<T>,
  options?: {
    retryDelay?: number;
    timeout?: number;
    signal?: AbortSignal;
    onContractWrite?: (hash: Hex) => MaybePromise<unknown>;
  }
) {
  return await throttleRequest(
    async () => {
      const retryDelay = (count: number) =>
        options?.retryDelay || ~~(1 << count) * 200;
      const timeout = options?.timeout || 180_000;
      const hash = await viemWriteContract(client, request);
      await options?.onContractWrite?.(hash);

      const startTime = Date.now();
      let retryCount = 0;
      let receipt: TransactionReceipt | undefined;
      while (!receipt) {
        if (options?.signal?.aborted) {
          throw new TerminationError();
        }

        try {
          receipt = await throttleRequest(
            () => getTransactionReceipt(client, { hash }),
            { signal: options?.signal }
          );
          if (receipt?.status !== "success") {
            receipt = undefined;
          }
        } catch (err) {
          // Skip TX not found errors and rethrow if something else happened
          if (
            !(
              err instanceof TransactionNotFoundError ||
              err instanceof TransactionReceiptNotFoundError
            )
          ) {
            throw err;
          }
        }

        await sleep(retryDelay(retryCount), options?.signal);
        retryCount++;

        if (Date.now() - startTime > timeout) {
          throw new TimeoutError(`waiting transaction (${hash})`);
        }
      }
    },
    { signal: options?.signal }
  );
}
