import type { AgreementDetails } from "../contracts/dto";
import type { AgreementReads } from "../ports/agreement.reads";

export class FindActiveAgreementByCustomerIdQuery {
  constructor(private readonly reads: AgreementReads) {}

  async execute(customerId: string): Promise<AgreementDetails | null> {
    return this.reads.findActiveByCustomerId(customerId);
  }
}
