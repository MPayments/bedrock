import { dedupeStrings } from "@bedrock/shared/core/domain";

import type { ClientReads } from "../ports/client.reads";

export class ListActiveClientsByCustomerIdsQuery {
  constructor(private readonly reads: ClientReads) {}

  async execute(customerIds: string[]) {
    return this.reads.listActiveByCustomerIds(dedupeStrings(customerIds));
  }
}
