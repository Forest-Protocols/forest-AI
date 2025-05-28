import { ErrorCode } from "@/constants";
import { AbstractError } from "./AbstractError";

export class InvalidChain extends AbstractError {
  constructor(chain: any) {
    super(ErrorCode.InvalidChain, `Invalid chain: ${chain}`, { chain });
    this.name = "InvalidChain";
  }
}
