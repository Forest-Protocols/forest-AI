import { z } from "zod";

/**
 * Parses the value as JSON
 */
export const JSONSchema = z.string().transform((value, ctx) => {
  let obj: any = {};
  try {
    obj = JSON.parse(value);
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid JSON object",
    });
    return z.NEVER;
  }

  return obj;
});
