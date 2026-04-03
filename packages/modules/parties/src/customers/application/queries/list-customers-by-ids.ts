import { dedupeStrings } from "@bedrock/shared/core/domain";

import type { CustomerReads } from "../ports/customer.reads";

export class ListCustomersByIdsQuery {
  constructor(private readonly reads: CustomerReads) {}

  async execute(ids: string[]) {
    return this.reads.listByIds(dedupeStrings(ids));
  }
}
