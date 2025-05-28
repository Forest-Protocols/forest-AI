import { existsSync, readFileSync } from "fs";
import { z } from "zod";

/**
 * Defines a Zod schema that parses the field as an object
 * with the given schema if the field value starts with "{"
 * or "[" characters. Otherwise interprets the field as a path and
 * tries to load JSON content from that file.
 * @param schema
 */
export function jsonOrFileSchema<T>(schema: z.Schema<T>) {
  return z.string().transform((value, ctx) => {
    // This is a file path
    if (
      !value.trimStart().startsWith("{") &&
      !value.trimStart().startsWith("[")
    ) {
      if (!existsSync(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `file "${value}" doesn't exist`,
        });
        return z.NEVER;
      }

      value = readFileSync(value).toString();
    }

    // Try to parse JSON string
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

    const validation = schema.safeParse(obj);

    if (validation.error) {
      validation.error.issues.forEach((issue) => ctx.addIssue(issue));
      return z.NEVER;
    }

    return validation.data;
  });
}
