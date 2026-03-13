import { and, eq, inArray } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/persistence";

import { schema } from "../schema";

export const TREASURY_ROOT_GROUP_CODE = "treasury";
export const CUSTOMERS_ROOT_GROUP_CODE = "customers";
export const TREASURY_INTERNAL_LEDGER_GROUP_CODE = "treasury_internal_entities";

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
  const { customersGroupId } = await ensureCounterpartyRootGroups(
    tx,
    onMissingGroup,
  );

  const [existing] = await tx
    .select({ id: schema.counterpartyGroups.id })
    .from(schema.counterpartyGroups)
    .where(
      and(
        eq(schema.counterpartyGroups.parentId, customersGroupId),
        eq(schema.counterpartyGroups.customerId, customerId),
      ),
    )
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
      parentId: customersGroupId,
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

export async function ensureCounterpartyRootGroups(
  tx: Transaction,
  onMissingRoots: () => Error,
): Promise<{
  treasuryGroupId: string;
  customersGroupId: string;
}> {
  const defs = [
    {
      code: TREASURY_ROOT_GROUP_CODE,
      name: "Treasury",
      description: "System root for treasury counterparties",
      isSystem: true,
    },
    {
      code: CUSTOMERS_ROOT_GROUP_CODE,
      name: "Customers",
      description: "System root for customer counterparties",
      isSystem: false,
    },
  ] as const;

  for (const def of defs) {
    await tx
      .insert(schema.counterpartyGroups)
      .values({
        code: def.code,
        name: def.name,
        description: def.description,
        parentId: null,
        customerId: null,
        isSystem: def.isSystem,
      })
      .onConflictDoNothing({
        target: schema.counterpartyGroups.code,
      });
  }

  const roots = await tx
    .select({
      id: schema.counterpartyGroups.id,
      code: schema.counterpartyGroups.code,
    })
    .from(schema.counterpartyGroups)
    .where(
      inArray(schema.counterpartyGroups.code, [
        TREASURY_ROOT_GROUP_CODE,
        CUSTOMERS_ROOT_GROUP_CODE,
      ]),
    );

  const treasuryGroupId = roots.find(
    (group) => group.code === TREASURY_ROOT_GROUP_CODE,
  )?.id;
  const customersGroupId = roots.find(
    (group) => group.code === CUSTOMERS_ROOT_GROUP_CODE,
  )?.id;

  if (!treasuryGroupId || !customersGroupId) {
    throw onMissingRoots();
  }

  return {
    treasuryGroupId,
    customersGroupId,
  };
}

export async function ensureTreasuryInternalLedgerGroup(input: {
  tx: Transaction;
  treasuryGroupId: string;
  onMissingGroup: () => Error;
}): Promise<string> {
  const { tx, treasuryGroupId, onMissingGroup } = input;

  await tx
    .insert(schema.counterpartyGroups)
    .values({
      code: TREASURY_INTERNAL_LEDGER_GROUP_CODE,
      name: "Treasury Internal Ledger Entities",
      description: "System subtree for internal ledger-owning entities",
      parentId: treasuryGroupId,
      customerId: null,
      isSystem: true,
    })
    .onConflictDoUpdate({
      target: schema.counterpartyGroups.code,
      set: {
        name: "Treasury Internal Ledger Entities",
        description: "System subtree for internal ledger-owning entities",
        parentId: treasuryGroupId,
        customerId: null,
        isSystem: true,
      },
    });

  const [treasuryInternalLedgerGroup] = await tx
    .select({
      id: schema.counterpartyGroups.id,
    })
    .from(schema.counterpartyGroups)
    .where(eq(schema.counterpartyGroups.code, TREASURY_INTERNAL_LEDGER_GROUP_CODE))
    .limit(1);

  if (!treasuryInternalLedgerGroup) {
    throw onMissingGroup();
  }

  return treasuryInternalLedgerGroup.id;
}
