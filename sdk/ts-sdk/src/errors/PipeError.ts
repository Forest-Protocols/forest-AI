import { PipeResponseCode } from "@/pipe";
import { AbstractError } from "./AbstractError";

export class PipeError extends AbstractError {
  constructor(code: PipeResponseCode, body?: any) {
    super(code, `Pipe error: ${body}`, {
      code,
      body,
    });
    this.name = "PipeError";
  }
}
