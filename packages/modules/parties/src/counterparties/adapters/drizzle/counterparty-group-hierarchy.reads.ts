import { asc } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { counterpartyGroups } from "./schema";
import type { CounterpartyGroupHierarchyReads } from "../../application/ports/counterparty-group-hierarchy.reads";

export class DrizzleCounterpartyGroupHierarchyReads
  implements CounterpartyGroupHierarchyReads
{
  constructor(private readonly db: Queryable) {}

  async listHierarchyNodes() {
    return this.db
      .select({
        id: counterpartyGroups.id,
        code: counterpartyGroups.code,
        parentId: counterpartyGroups.parentId,
        customerId: counterpartyGroups.customerId,
      })
      .from(counterpartyGroups)
      .orderBy(asc(counterpartyGroups.createdAt), asc(counterpartyGroups.id));
  }
}
