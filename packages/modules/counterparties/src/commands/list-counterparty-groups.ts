import { and, asc, eq, type SQL } from "drizzle-orm";

import { schema } from "@bedrock/counterparties/schema";

import type { CounterpartiesServiceContext } from "../internal/context";
import { ensureSystemRootGroups } from "../internal/group-rules";
import {
  ListCounterpartyGroupsQuerySchema,
  type CounterpartyGroup,
  type ListCounterpartyGroupsQuery,
} from "../validation";

export function createListCounterpartyGroupsHandler(
  context: CounterpartiesServiceContext,
) {
  const { db } = context;

  return async function listCounterpartyGroups(
    input?: ListCounterpartyGroupsQuery,
  ): Promise<CounterpartyGroup[]> {
    const validated = ListCounterpartyGroupsQuerySchema.parse(input ?? {});

    return db.transaction(async (tx) => {
      await ensureSystemRootGroups(tx);

      const conditions: SQL[] = [];

      if (validated.parentId) {
        conditions.push(
          eq(schema.counterpartyGroups.parentId, validated.parentId),
        );
      }

      if (validated.customerId) {
        conditions.push(
          eq(schema.counterpartyGroups.customerId, validated.customerId),
        );
      }

      if (validated.includeSystem === false) {
        conditions.push(eq(schema.counterpartyGroups.isSystem, false));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      return tx
        .select()
        .from(schema.counterpartyGroups)
        .where(where)
        .orderBy(asc(schema.counterpartyGroups.name));
    });
  };
}
