import {
  ListContractsQuerySchema,
  type ListContractsQuery as ListContractsQueryInput,
} from "../contracts/queries";
import type { ContractReads } from "../ports/contract.reads";

export class ListContractsQuery {
  constructor(private readonly reads: ContractReads) {}

  async execute(input?: ListContractsQueryInput) {
    const query = ListContractsQuerySchema.parse(input ?? {});
    return this.reads.list(query);
  }
}
