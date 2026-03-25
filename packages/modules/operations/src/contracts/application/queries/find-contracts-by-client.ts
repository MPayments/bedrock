import type { ContractReads } from "../ports/contract.reads";

export class FindContractsByClientQuery {
  constructor(private readonly reads: ContractReads) {}

  async execute(clientId: number) {
    return this.reads.findByClientId(clientId);
  }
}
