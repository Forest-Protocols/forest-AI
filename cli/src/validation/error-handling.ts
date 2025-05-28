import { z } from "zod";

/**
 * Checks validation error and throws an error
 * with a formatted message text.
 * @returns Data of the validation.
 */
export function checkValidationError<T, K>(
  safeParseReturn: z.SafeParseReturnType<T, K>,
  path?: string
) {
  path ??= "";

  if (safeParseReturn?.error) {
    const firstError = safeParseReturn.error.errors[0];

    if (path) {
      path = `${path}: `;
    }

    // Include path if there is
    path =
      firstError.path.length > 0 ? `"${firstError.path.join(".")}": ` : path;
    throw new Error(`${path}${firstError.message}`);
  }

  return safeParseReturn.data;
}
