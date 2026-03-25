import {
  ListDealsQuerySchema,
  type ListDealsQuery as ListDealsQueryInput,
} from "../contracts/queries";
import type { DealReads } from "../ports/deal.reads";

export class ListDealsQuery {
  constructor(private readonly reads: DealReads) {}

  async execute(input?: ListDealsQueryInput) {
    const query = ListDealsQuerySchema.parse(input ?? {});
    return this.reads.list(query);
  }
}
