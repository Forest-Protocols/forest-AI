import { TerminationError } from "@/errors";

/**
 * Waits for the given milliseconds.
 * Throws error if the abort signal is fired.
 */
export async function sleep(ms: number, signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new TerminationError();
  }

  return await new Promise<void>((res, rej) => {
    let timeout: NodeJS.Timeout | undefined = undefined;
    const abortHandler = () => {
      if (timeout) {
        clearTimeout(timeout);
      }

      rej(new TerminationError());
    };

    signal?.addEventListener("abort", abortHandler);
    timeout = setTimeout(() => {
      signal?.removeEventListener("abort", abortHandler);
      if (!signal?.aborted) {
        res();
      } else {
        rej(new TerminationError());
      }
    }, ms);
  });
}
