import { ContractNotFoundError } from "../../../errors";
import type { ContractReads } from "../ports/contract.reads";

export class FindContractByIdQuery {
  constructor(private readonly reads: ContractReads) {}

  async execute(id: number) {
    const contract = await this.reads.findById(id);
    if (!contract) {
      throw new ContractNotFoundError(id);
    }
    return contract;
  }
}
