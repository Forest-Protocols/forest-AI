import { createAccount } from "@/utils";
import { z } from "zod";

/**
 * Zod schema to load account private key. If there is an existing file
 * with the given value, it uses its content as the private key. Otherwise
 * uses the value itself as the private key.
 *
 * NOTE: Actual implementation is in `src/config/index.ts`, in account config definition. This zod schema still exist because otherwise we would need to edit all of the commands to use `createAccount` instead of this schema.
 */
export const accountFileOrKeySchema = z
  .string()
  .optional()
  .transform((_, ctx) => {
    try {
      return createAccount();
    } catch {
      // Account was mandatory but not found
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "No account option is given",
      });
      return z.NEVER;
    }
  });
