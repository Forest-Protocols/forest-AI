import { PipeError } from "@/errors";
import { PipeResponseCode } from "./AbstractPipe";
import { z } from "zod";

/**
 * Validates a body object. If it is not valid,
 * throws a bad request Pipe error with a validation
 * error message.
 * @param bodyOrParams
 * @param schema
 */
export function validateBodyOrParams<T>(
  bodyOrParams: any,
  schema: z.Schema<T>
) {
  const bodyValidation = schema.safeParse(bodyOrParams);
  if (bodyValidation.error) {
    throw new PipeError(PipeResponseCode.BAD_REQUEST, {
      message: "Validation error",
      body: bodyValidation.error.issues,
    });
  }

  return bodyValidation.data;
}
