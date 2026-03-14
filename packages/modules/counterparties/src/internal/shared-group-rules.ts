import { eq } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/platform-persistence";

import { schema } from "../schema";

export function dedupeIds(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

export async function ensureCustomerGroupForCustomer(input: {
  tx: Transaction;
  customerId: string;
  onMissingCustomer: () => Error;
  onMissingGroup: () => Error;
  buildGroupName?: (customerDisplayName: string, customerId: string) => string;
}): Promise<string> {
  const { tx, customerId, onMissingCustomer, onMissingGroup } = input;

  const [existing] = await tx
    .select({ id: schema.counterpartyGroups.id })
    .from(schema.counterpartyGroups)
    .where(eq(schema.counterpartyGroups.code, `customer:${customerId}`))
    .limit(1);

  if (existing) {
    return existing.id;
  }

  const [customer] = await tx
    .select({
      displayName: schema.customersRef.displayName,
    })
    .from(schema.customersRef)
    .where(eq(schema.customersRef.id, customerId))
    .limit(1);

  if (!customer) {
    throw onMissingCustomer();
  }

  const groupName = input.buildGroupName
    ? input.buildGroupName(customer.displayName, customerId)
    : customer.displayName || `Customer ${customerId}`;

  await tx
    .insert(schema.counterpartyGroups)
    .values({
      code: `customer:${customerId}`,
      name: groupName,
      description: "Auto-created customer group",
      parentId: null,
      customerId,
      isSystem: false,
    })
    .onConflictDoNothing({
      target: schema.counterpartyGroups.code,
    });

  const [created] = await tx
    .select({ id: schema.counterpartyGroups.id })
    .from(schema.counterpartyGroups)
    .where(eq(schema.counterpartyGroups.code, `customer:${customerId}`))
    .limit(1);

  if (!created) {
    throw onMissingGroup();
  }

  return created.id;
}

export async function listCounterpartyGroupSubtreeIds(
  db: Database | Transaction,
  rootGroupId: string,
): Promise<string[]> {
  const groups = await db
    .select({
      id: schema.counterpartyGroups.id,
      parentId: schema.counterpartyGroups.parentId,
    })
    .from(schema.counterpartyGroups);

  if (!groups.some((group) => group.id === rootGroupId)) {
    return [];
  }

  const childrenByParentId = new Map<string, string[]>();
  for (const group of groups) {
    if (!group.parentId) {
      continue;
    }

    const children = childrenByParentId.get(group.parentId);
    if (children) {
      children.push(group.id);
    } else {
      childrenByParentId.set(group.parentId, [group.id]);
    }
  }

  const subtreeIds: string[] = [];
  const visited = new Set<string>();
  const stack = [rootGroupId];

  while (stack.length > 0) {
    const currentId = stack.pop()!;
    if (visited.has(currentId)) {
      continue;
    }
    visited.add(currentId);
    subtreeIds.push(currentId);

    const children = childrenByParentId.get(currentId);
    if (!children) {
      continue;
    }
    stack.push(...children);
  }

  return subtreeIds;
}
