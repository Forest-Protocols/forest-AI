import { ErrorCode } from "@/constants";
import { AbstractError } from "./AbstractError";

export class ContractNotFound extends AbstractError {
  constructor(address: any, chain: any) {
    super(
      ErrorCode.ContractNotFound,
      `Smart contract ${address} not found in chain ${chain}`,
      { address, chain }
    );
    this.name = "ContractNotFound";
  }
}
