import stableStringify from "json-stable-stringify";

/**
 * Alias for `tryParseJSON`.
 * @deprecated Use `tryParseJSON` instead.
 */
export function tryReadJson<T>(content?: string): T | undefined {
  return tryParseJSON<T>(content);
}

/**
 * Tries to parse the given content as a JSON entity.
 * Returns `undefined` or the `content` itself (depends on
 * the second parameter) if the given content is not a valid JSON.
 */
export function tryParseJSON<T>(content?: string): T | undefined;
export function tryParseJSON<T>(
  content: string,
  /**
   * If true, returns the given content
   */
  returnContentInFailure: true
): T | string | undefined;
export function tryParseJSON<T>(
  content: string,
  /**
   * If true, returns the given content
   */
  returnContentInFailure: false
): T | undefined;
export function tryParseJSON<T>(
  content?: string,
  /**
   * If true, returns the given content
   */
  returnContentInFailure?: boolean
): T | undefined | string {
  if (content === undefined) return;

  try {
    return JSON.parse(content);
  } catch {
    if (returnContentInFailure) {
      return content;
    }
    return undefined;
  }
}

/**
 * Consistently converts a JSON entity into a string.
 * @param json The JSON object to convert.
 * @returns The JSON string representation of the object.
 */
export function stringifyJSON(json: any): string | undefined {
  return stableStringify(json);
}
