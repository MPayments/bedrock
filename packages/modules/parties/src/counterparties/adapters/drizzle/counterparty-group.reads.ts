import { and, asc, eq, type SQL } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { counterpartyGroups } from "./schema";
import { customers } from "../../../customers/adapters/drizzle/schema";
import type { CounterpartyGroup } from "../../application/contracts/counterparty-group.dto";
import type { ListCounterpartyGroupsQuery } from "../../application/contracts/counterparty-group.queries";
import type { CounterpartyGroupReads } from "../../application/ports/counterparty-group.reads";

export class DrizzleCounterpartyGroupReads implements CounterpartyGroupReads {
  constructor(private readonly db: Queryable) {}

  async list(input: ListCounterpartyGroupsQuery): Promise<CounterpartyGroup[]> {
    const conditions: SQL[] = [];

    if (input.parentId) {
      conditions.push(eq(counterpartyGroups.parentId, input.parentId));
    }

    if (input.customerId) {
      conditions.push(eq(counterpartyGroups.customerId, input.customerId));
    }

    if (input.includeSystem === false) {
      conditions.push(eq(counterpartyGroups.isSystem, false));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    return this.db
      .select({
        id: counterpartyGroups.id,
        code: counterpartyGroups.code,
        name: counterpartyGroups.name,
        description: counterpartyGroups.description,
        parentId: counterpartyGroups.parentId,
        customerId: counterpartyGroups.customerId,
        customerLabel: customers.displayName,
        isSystem: counterpartyGroups.isSystem,
        createdAt: counterpartyGroups.createdAt,
        updatedAt: counterpartyGroups.updatedAt,
      })
      .from(counterpartyGroups)
      .leftJoin(customers, eq(counterpartyGroups.customerId, customers.id))
      .where(where)
      .orderBy(asc(counterpartyGroups.name));
  }
}
