import { ErrorCode } from "@/constants";
import { AbstractError } from "./AbstractError";

export class InsufficientAllowance extends AbstractError {
  constructor(contract: any) {
    super(
      ErrorCode.InsufficientAllowance,
      `Allowance is not sufficient for the desired action. Please increase allowance for smart contract ${contract}`,
      { contract }
    );
    this.name = "InsufficientAllowance";
  }
}
