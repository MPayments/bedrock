import { BankDetailsNotFoundError } from "../../../errors";
import type { BankDetailsReads } from "../ports/bank-details.reads";

export class FindBankDetailsByIdQuery {
  constructor(private readonly reads: BankDetailsReads) {}

  async execute(id: number) {
    const bankDetails = await this.reads.findById(id);
    if (!bankDetails) {
      throw new BankDetailsNotFoundError(id);
    }
    return bankDetails;
  }
}
