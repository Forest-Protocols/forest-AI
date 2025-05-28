import { existsSync, readFileSync } from "fs";
import { z } from "zod";

/**
 * Reads the file from the path in the given `value`
 */
export const fileSchema = z.string().transform((value, ctx) => {
  if (!existsSync(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `file "${value}" doesn't exist`,
    });
    return z.NEVER;
  }

  return readFileSync(value).toString();
});
