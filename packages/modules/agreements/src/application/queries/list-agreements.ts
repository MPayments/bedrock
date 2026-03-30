import {
  ListAgreementsQuerySchema,
  type ListAgreementsQuery as ListAgreementsQueryInput,
} from "../contracts/queries";
import type { AgreementReads } from "../ports/agreement.reads";

export class ListAgreementsQuery {
  constructor(private readonly reads: AgreementReads) {}

  async execute(input?: ListAgreementsQueryInput) {
    const validated = ListAgreementsQuerySchema.parse(input ?? {});
    return this.reads.list(validated);
  }
}
