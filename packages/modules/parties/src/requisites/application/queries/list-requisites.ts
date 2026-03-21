import {
  ListRequisitesQuerySchema,
  type ListRequisitesInput,
} from "../contracts/requisites";
import type { RequisiteReads } from "../ports/requisite.reads";

export class ListRequisitesQuery {
  constructor(private readonly reads: RequisiteReads) {}

  execute(input?: ListRequisitesInput) {
    const query = ListRequisitesQuerySchema.parse(input ?? {});

    return this.reads.list(query);
  }
}
