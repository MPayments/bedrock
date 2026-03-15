import { eq, inArray } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/platform/persistence";
import { dedupeIds } from "@bedrock/shared/core/domain";
import { schema } from "../schema";

export async function readMembershipIds(
  db: Database,
  counterpartyId: string,
  tx?: Transaction,
): Promise<string[]> {
  const database = tx ?? db;
  const rows = await database
    .select({ groupId: schema.counterpartyGroupMemberships.groupId })
    .from(schema.counterpartyGroupMemberships)
    .where(
      eq(schema.counterpartyGroupMemberships.counterpartyId, counterpartyId),
    );

  return rows.map((row) => row.groupId);
}

export async function readMembershipMap(
  db: Database,
  counterpartyIds: string[],
  tx?: Transaction,
): Promise<Map<string, string[]>> {
  const database = tx ?? db;
  const uniqueIds = dedupeIds(counterpartyIds);
  const map = new Map<string, string[]>();
  if (uniqueIds.length === 0) {
    return map;
  }

  const rows = await database
    .select({
      counterpartyId: schema.counterpartyGroupMemberships.counterpartyId,
      groupId: schema.counterpartyGroupMemberships.groupId,
    })
    .from(schema.counterpartyGroupMemberships)
    .where(
      inArray(schema.counterpartyGroupMemberships.counterpartyId, uniqueIds),
    );

  for (const row of rows) {
    const groupIds = map.get(row.counterpartyId);
    if (groupIds) {
      groupIds.push(row.groupId);
      continue;
    }

    map.set(row.counterpartyId, [row.groupId]);
  }

  return map;
}
