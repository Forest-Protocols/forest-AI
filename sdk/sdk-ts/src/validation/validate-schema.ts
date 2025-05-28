import { z } from "zod";
import { fromError } from "zod-validation-error";

/**
 * Validates a Zod schema and throws an error
 * with a human readable message.
 * @param obj
 * @param schema
 */
export function validateSchema<T>(obj: any, schema: z.Schema<T>) {
  const validation = schema.safeParse(obj);

  if (validation.error) {
    throw new Error(fromError(validation.error).toString());
  }
}
