import { AgreementNotFoundError } from "../../errors";
import type { AgreementDetails } from "../contracts/dto";
import type { AgreementReads } from "../ports/agreement.reads";

export class FindAgreementByIdQuery {
  constructor(private readonly reads: AgreementReads) {}

  async execute(id: string): Promise<AgreementDetails> {
    const agreement = await this.reads.findById(id);

    if (!agreement) {
      throw new AgreementNotFoundError(id);
    }

    return agreement;
  }
}
