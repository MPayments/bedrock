import {
  ListRequisiteProvidersQuerySchema,
  type ListRequisiteProvidersQuery as ListRequisiteProvidersInput,
} from "../contracts/queries";
import type { RequisiteProviderReads } from "../ports/requisite-provider.reads";

export class ListRequisiteProvidersQuery {
  constructor(private readonly reads: RequisiteProviderReads) {}

  execute(input?: ListRequisiteProvidersInput) {
    const query = ListRequisiteProvidersQuerySchema.parse(input ?? {});
    return this.reads.list(query);
  }
}
