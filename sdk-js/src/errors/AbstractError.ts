/**
 * Base class that all of the Forest Protocol related errors inherited from.
 */
export abstract class AbstractError extends Error {
  code: number | string;
  message: string;
  meta: any;

  constructor(code: number | string, message: string, meta?: any) {
    super(message);
    this.code = code;
    this.message = message;
    this.meta = meta;
    this.name = "AbstractError";
  }
}
