import { ErrorCode } from "@/constants";
import { AbstractError } from "./AbstractError";

export class InsufficientBalance extends AbstractError {
  constructor() {
    super(
      ErrorCode.InsufficientBalance,
      `Balance is not enough for the desired action.`
    );
    this.name = "InsufficientBalance";
  }
}
