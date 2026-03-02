import { and, eq, inArray, sql } from "drizzle-orm";

import type { Transaction } from "@bedrock/foundation/db-types";
import { schema as counterpartiesSchema } from "@bedrock/counterparties/schema";
import { schema as customersSchema } from "@bedrock/customers/schema";

import { CustomerInvariantError } from "../errors";

const schema = {
  ...customersSchema,
  ...counterpartiesSchema,
};

interface GroupNode {
  id: string;
  parentId: string | null;
  code: string;
}

const TREASURY_ROOT_GROUP_CODE = "treasury";
const CUSTOMERS_ROOT_GROUP_CODE = "customers";

async function ensureSystemRootGroups(tx: Transaction): Promise<{
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
    throw new CustomerInvariantError("System root groups are not available");
  }

  return {
    treasuryGroupId,
    customersGroupId,
  };
}

export async function ensureCustomerGroupForCustomer(
  tx: Transaction,
  customerId: string,
  displayName: string,
): Promise<string> {
  const { customersGroupId } = await ensureSystemRootGroups(tx);
  const code = `customer:${customerId}`;

  await tx
    .insert(schema.counterpartyGroups)
    .values({
      code,
      name: displayName,
      description: "Auto-created customer group",
      parentId: customersGroupId,
      customerId,
      isSystem: false,
    })
    .onConflictDoNothing({
      target: schema.counterpartyGroups.code,
    });

  const [group] = await tx
    .select({
      id: schema.counterpartyGroups.id,
    })
    .from(schema.counterpartyGroups)
    .where(eq(schema.counterpartyGroups.code, code))
    .limit(1);

  if (!group) {
    throw new CustomerInvariantError(
      `Failed to ensure customer group for customer ${customerId}`,
    );
  }

  return group.id;
}

export async function removeCustomerGroupForCustomer(
  tx: Transaction,
  customerId: string,
): Promise<void> {
  await tx
    .delete(schema.counterpartyGroups)
    .where(eq(schema.counterpartyGroups.code, `customer:${customerId}`));
}

async function loadGroupMap(tx: Transaction) {
  const rows = await tx
    .select({
      id: schema.counterpartyGroups.id,
      parentId: schema.counterpartyGroups.parentId,
      code: schema.counterpartyGroups.code,
    })
    .from(schema.counterpartyGroups);

  return new Map<string, GroupNode>(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        parentId: row.parentId,
        code: row.code,
      },
    ]),
  );
}

function resolveRootCode(
  groupMap: Map<string, GroupNode>,
  groupId: string,
): string | null {
  const visited = new Set<string>();
  let cursor = groupMap.get(groupId);

  while (cursor) {
    if (visited.has(cursor.id)) {
      throw new CustomerInvariantError(
        `Counterparty group hierarchy loop detected at group ${cursor.id}`,
      );
    }
    visited.add(cursor.id);

    if (!cursor.parentId) {
      return cursor.code;
    }

    const parent = groupMap.get(cursor.parentId);
    if (!parent) {
      throw new CustomerInvariantError(
        `Counterparty group parent not found for ${cursor.id}`,
      );
    }

    cursor = parent;
  }

  return null;
}

export async function detachCounterpartiesFromCustomerTree(
  tx: Transaction,
  customerId: string,
) {
  const linkedCounterparties = await tx
    .select({
      id: schema.counterparties.id,
    })
    .from(schema.counterparties)
    .where(eq(schema.counterparties.customerId, customerId));

  const linkedCounterpartyIds = linkedCounterparties.map((row) => row.id);

  if (linkedCounterpartyIds.length > 0) {
    const memberships = await tx
      .select({
        counterpartyId: schema.counterpartyGroupMemberships.counterpartyId,
        groupId: schema.counterpartyGroupMemberships.groupId,
      })
      .from(schema.counterpartyGroupMemberships)
      .where(
        inArray(
          schema.counterpartyGroupMemberships.counterpartyId,
          linkedCounterpartyIds,
        ),
      );

    const groupMap = await loadGroupMap(tx);
    const removableGroupIds = Array.from(
      new Set(
        memberships
          .filter((membership) => {
            const rootCode = resolveRootCode(groupMap, membership.groupId);
            return rootCode === CUSTOMERS_ROOT_GROUP_CODE;
          })
          .map((membership) => membership.groupId),
      ),
    );

    if (removableGroupIds.length > 0) {
      await tx
        .delete(schema.counterpartyGroupMemberships)
        .where(
          and(
            inArray(
              schema.counterpartyGroupMemberships.counterpartyId,
              linkedCounterpartyIds,
            ),
            inArray(
              schema.counterpartyGroupMemberships.groupId,
              removableGroupIds,
            ),
          ),
        );
    }

    await tx
      .update(schema.counterparties)
      .set({
        customerId: null,
        updatedAt: sql`now()`,
      })
      .where(inArray(schema.counterparties.id, linkedCounterpartyIds));
  }
}
