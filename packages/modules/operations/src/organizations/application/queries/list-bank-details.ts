import { ListBankDetailsQuerySchema } from "../contracts/bank-details-queries";
import type { BankDetailsReads } from "../ports/bank-details.reads";

export class ListBankDetailsQuery {
  constructor(private readonly reads: BankDetailsReads) {}

  async execute(input?: unknown) {
    const query = ListBankDetailsQuerySchema.parse(input ?? {});
    return this.reads.list(query);
  }
}
