import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type { Deal } from "../contracts/dto";
import {
  ListDealsQuerySchema,
  type ListDealsQuery as ListDealsQueryInput,
} from "../contracts/queries";
import type { DealReads } from "../ports/deal.reads";

export class ListDealsQuery {
  constructor(private readonly reads: DealReads) {}

  async execute(
    input?: ListDealsQueryInput,
  ): Promise<PaginatedList<Deal>> {
    const query = ListDealsQuerySchema.parse(input ?? {});
    return this.reads.list(query);
  }
}
