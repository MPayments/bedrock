import { and, asc, eq, type SQL } from "drizzle-orm";

import { schema } from "@bedrock/parties/counterparties/schema";

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
        .select({
          id: schema.counterpartyGroups.id,
          code: schema.counterpartyGroups.code,
          name: schema.counterpartyGroups.name,
          description: schema.counterpartyGroups.description,
          parentId: schema.counterpartyGroups.parentId,
          customerId: schema.counterpartyGroups.customerId,
          customerLabel: schema.customersRef.displayName,
          isSystem: schema.counterpartyGroups.isSystem,
          createdAt: schema.counterpartyGroups.createdAt,
          updatedAt: schema.counterpartyGroups.updatedAt,
        })
        .from(schema.counterpartyGroups)
        .leftJoin(
          schema.customersRef,
          eq(schema.counterpartyGroups.customerId, schema.customersRef.id),
        )
        .where(where)
        .orderBy(asc(schema.counterpartyGroups.name));
    });
  };
}
