import { sleep } from "./utils";

const globalRateLimit = {
  limit: 25,
  timeWindow: 1000,
  timestamps: [] as number[],
};

/**
 * Gets global rate limit. If it is zero, then disabled.
 */
export function getGlobalRateLimit() {
  return globalRateLimit.limit;
}

/**
 * Sets global rate limit for the requests.
 */
export function setGlobalRateLimit(rps: number) {
  globalRateLimit.limit = rps;
}

/**
 * Gets global time window of global rate limit.
 */
export function getGlobalRateLimitTimeWindow() {
  return globalRateLimit.timeWindow;
}

/**
 * Sets global time window of global rate limit.
 */
export function setGlobalRateLimitTimeWindow(ms: number) {
  globalRateLimit.timeWindow = ms;
}

export type ThrottleRequestOptions = {
  /**
   * How many calls will be done within `func'.
   * @default 1
   */
  count?: number;

  /**
   * Abort signal
   */
  signal?: AbortSignal;
};

/**
 * Executes the given function which makes requests to the RPC node,
 * but takes rate limit into account and blocks newer requests if rate
 * limit is already exceeded.
 */
export async function throttleRequest<T = unknown>(
  func: () => Promise<T>,
  options?: ThrottleRequestOptions
): Promise<T> {
  // If the value is zero (or lesser) that means there is no rate limit
  if (globalRateLimit.limit <= 0) {
    return await func();
  }

  await waitForRateLimit(options?.count || 1, options?.signal);
  return await func();
}

/**
 * Waits until rate limit is refreshed
 * @param count How many calls we are waiting for?
 * @param signal Abort Signal
 */
export async function waitForRateLimit(count = 1, signal?: AbortSignal) {
  const now = Date.now();

  // Clear the timestamps from the old time period
  globalRateLimit.timestamps = globalRateLimit.timestamps.filter(
    (ts) => now - ts < globalRateLimit.timeWindow
  );

  // Check if there are empty slots for the requests
  if (globalRateLimit.timestamps.length + count < globalRateLimit.limit) {
    for (let i = 0; i < count; i++) {
      globalRateLimit.timestamps.push(now);
    }
    return;
  }

  // Calculate how much time should we wait for the next time window
  const earliest = globalRateLimit.timestamps[0];
  const waitTime = globalRateLimit.timeWindow - (now - earliest);

  await sleep(waitTime, signal);

  // Retry again
  return waitForRateLimit(count, signal);
}
