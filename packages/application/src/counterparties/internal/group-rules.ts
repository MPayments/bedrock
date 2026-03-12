import { eq, inArray } from "drizzle-orm";

import {
  customersRef,
  schema as counterpartiesSchema,
} from "@bedrock/application/counterparties/schema";
import type { Database, Transaction } from "@bedrock/common/db/types";

import {
  CounterpartyCustomerNotFoundError,
  CounterpartyGroupNotFoundError,
  CounterpartyGroupRuleError,
} from "../errors";
import type { CounterpartyGroupRootCode } from "../validation";
import {
  CUSTOMERS_ROOT_GROUP_CODE,
  dedupeIds,
  ensureCounterpartyRootGroups,
  ensureCustomerGroupForCustomer as ensureCustomerGroupForCustomerShared,
  ensureTreasuryInternalLedgerGroup,
  TREASURY_ROOT_GROUP_CODE,
} from "./shared-group-rules";

export {
  CUSTOMERS_ROOT_GROUP_CODE,
  TREASURY_INTERNAL_LEDGER_GROUP_CODE,
  TREASURY_ROOT_GROUP_CODE,
} from "./shared-group-rules";

const schema = {
  ...counterpartiesSchema,
  customers: customersRef,
};

interface GroupNode {
  id: string;
  code: string;
  parentId: string | null;
  customerId: string | null;
}

export interface GroupMembershipClassification {
  rootsByGroupId: Map<string, CounterpartyGroupRootCode | null>;
  customerScopeByGroupId: Map<string, string | null>;
  hasTreasury: boolean;
  hasCustomers: boolean;
  customerScopedIds: Set<string>;
}

async function loadGroupMap(db: Database | Transaction) {
  const groups = await db
    .select({
      id: schema.counterpartyGroups.id,
      code: schema.counterpartyGroups.code,
      parentId: schema.counterpartyGroups.parentId,
      customerId: schema.counterpartyGroups.customerId,
    })
    .from(schema.counterpartyGroups);

  return new Map<string, GroupNode>(
    groups.map((group) => [
      group.id,
      {
        id: group.id,
        code: group.code,
        parentId: group.parentId,
        customerId: group.customerId,
      },
    ]),
  );
}

function resolvePathToRoot(
  groupMap: Map<string, GroupNode>,
  groupId: string,
): GroupNode[] {
  const node = groupMap.get(groupId);
  if (!node) {
    throw new CounterpartyGroupNotFoundError(groupId);
  }

  const path: GroupNode[] = [];
  const visited = new Set<string>();
  let current: GroupNode | undefined = node;

  while (current) {
    if (visited.has(current.id)) {
      throw new CounterpartyGroupRuleError(
        `Counterparty group hierarchy loop detected at group ${current.id}`,
      );
    }

    visited.add(current.id);
    path.push(current);

    if (!current.parentId) {
      break;
    }

    current = groupMap.get(current.parentId);
    if (!current) {
      throw new CounterpartyGroupNotFoundError(groupId);
    }
  }

  return path;
}

export async function resolveGroupMembershipClassification(
  db: Database | Transaction,
  rawGroupIds: string[],
): Promise<GroupMembershipClassification> {
  const groupIds = dedupeIds(rawGroupIds);

  const classification: GroupMembershipClassification = {
    rootsByGroupId: new Map<string, CounterpartyGroupRootCode | null>(),
    customerScopeByGroupId: new Map<string, string | null>(),
    hasTreasury: false,
    hasCustomers: false,
    customerScopedIds: new Set<string>(),
  };

  if (groupIds.length === 0) {
    return classification;
  }

  const groupMap = await loadGroupMap(db);

  for (const groupId of groupIds) {
    const path = resolvePathToRoot(groupMap, groupId);
    const root = path[path.length - 1]!;

    const rootCode =
      root.code === TREASURY_ROOT_GROUP_CODE
        ? TREASURY_ROOT_GROUP_CODE
        : root.code === CUSTOMERS_ROOT_GROUP_CODE
          ? CUSTOMERS_ROOT_GROUP_CODE
          : null;

    classification.rootsByGroupId.set(groupId, rootCode);

    if (rootCode === TREASURY_ROOT_GROUP_CODE) {
      classification.hasTreasury = true;
    }
    if (rootCode === CUSTOMERS_ROOT_GROUP_CODE) {
      classification.hasCustomers = true;
    }

    const scopedCustomerId =
      path.find((node) => Boolean(node.customerId))?.customerId ?? null;
    classification.customerScopeByGroupId.set(groupId, scopedCustomerId);

    if (scopedCustomerId) {
      classification.customerScopedIds.add(scopedCustomerId);
    }
  }

  return classification;
}

export function enforceCustomerLinkRules(
  classification: GroupMembershipClassification,
  customerId: string | null | undefined,
) {
  if (classification.hasTreasury && classification.hasCustomers) {
    throw new CounterpartyGroupRuleError(
      "Counterparty cannot belong to both treasury and customers group trees",
    );
  }

  if (classification.hasCustomers && !customerId) {
    throw new CounterpartyGroupRuleError(
      "customerId is required for customers tree memberships",
    );
  }

  if (classification.hasTreasury && customerId) {
    throw new CounterpartyGroupRuleError(
      "customerId must be null for treasury tree memberships",
    );
  }

  if (!customerId) {
    return;
  }

  for (const scopedCustomerId of classification.customerScopedIds) {
    if (scopedCustomerId !== customerId) {
      throw new CounterpartyGroupRuleError(
        `customerId ${customerId} does not match scoped customer group ${scopedCustomerId}`,
      );
    }
  }
}

export async function ensureSystemRootGroups(tx: Transaction): Promise<{
  treasuryGroupId: string;
  customersGroupId: string;
  treasuryInternalLedgerGroupId: string;
}> {
  const { treasuryGroupId, customersGroupId } = await ensureCounterpartyRootGroups(
    tx,
    () =>
      new CounterpartyGroupRuleError("System root groups are not available"),
  );
  const treasuryInternalLedgerGroupId = await ensureTreasuryInternalLedgerGroup({
    tx,
    treasuryGroupId,
    onMissingGroup: () =>
      new CounterpartyGroupRuleError(
        "Treasury internal ledger group is not available",
      ),
  });

  return {
    treasuryGroupId,
    customersGroupId,
    treasuryInternalLedgerGroupId,
  };
}

export async function ensureCustomerGroupForCustomer(
  tx: Transaction,
  customerId: string,
): Promise<string> {
  return ensureCustomerGroupForCustomerShared({
    tx,
    customerId,
    onMissingCustomer: () => new CounterpartyCustomerNotFoundError(customerId),
    onMissingGroup: () =>
      new CounterpartyGroupRuleError(
        `Failed to ensure customer group for customer ${customerId}`,
      ),
    buildGroupName: (displayName) => displayName,
  });
}

export async function assertCustomerExists(
  db: Database | Transaction,
  customerId: string,
) {
  const [customer] = await db
    .select({
      id: schema.customers.id,
    })
    .from(schema.customers)
    .where(eq(schema.customers.id, customerId))
    .limit(1);

  if (!customer) {
    throw new CounterpartyCustomerNotFoundError(customerId);
  }
}

export async function withoutRootGroups(
  db: Database | Transaction,
  rawGroupIds: string[],
  rootCodeToExclude: CounterpartyGroupRootCode,
): Promise<string[]> {
  const groupIds = dedupeIds(rawGroupIds);
  if (groupIds.length === 0) {
    return groupIds;
  }

  const classification = await resolveGroupMembershipClassification(
    db,
    groupIds,
  );

  return groupIds.filter((groupId) => {
    const root = classification.rootsByGroupId.get(groupId);
    return root !== rootCodeToExclude;
  });
}

export async function replaceMemberships(
  tx: Transaction,
  counterpartyId: string,
  rawGroupIds: string[],
) {
  const groupIds = dedupeIds(rawGroupIds);

  await tx
    .delete(schema.counterpartyGroupMemberships)
    .where(
      eq(schema.counterpartyGroupMemberships.counterpartyId, counterpartyId),
    );

  if (groupIds.length === 0) {
    return;
  }

  await tx.insert(schema.counterpartyGroupMemberships).values(
    groupIds.map((groupId) => ({
      counterpartyId,
      groupId,
    })),
  );
}

export async function readMembershipIds(
  db: Database | Transaction,
  counterpartyId: string,
): Promise<string[]> {
  const rows = await db
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
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (counterpartyIds.length === 0) {
    return map;
  }

  const rows = await db
    .select({
      counterpartyId: schema.counterpartyGroupMemberships.counterpartyId,
      groupId: schema.counterpartyGroupMemberships.groupId,
    })
    .from(schema.counterpartyGroupMemberships)
    .where(
      inArray(
        schema.counterpartyGroupMemberships.counterpartyId,
        counterpartyIds,
      ),
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
