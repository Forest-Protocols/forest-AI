import { PipeResponseCode } from "@/pipe";
import { AbstractError } from "./AbstractError";

export class PipeError extends AbstractError {
  constructor(code: PipeResponseCode, body?: any) {
    super(code, `Pipe error: ${JSON.stringify(body)}`, {
      code,
      body,
    });
    this.name = "PipeError";
  }
}
