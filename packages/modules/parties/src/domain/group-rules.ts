import {
  CounterpartyGroupNotFoundError,
  CounterpartyGroupRuleError,
} from "../errors";

export interface GroupNode {
  id: string;
  code: string;
  parentId: string | null;
  customerId: string | null;
}

export interface GroupMembershipClassification {
  customerScopeByGroupId: Map<string, string | null>;
  customerScopedIds: Set<string>;
}

export function dedupeIds(ids: string[]): string[] {
  return Array.from(new Set(ids.filter(Boolean)));
}

export function buildManagedCustomerGroupCode(customerId: string): string {
  return `customer:${customerId}`;
}

export function isManagedCustomerGroupCode(code: string): boolean {
  return code.startsWith("customer:");
}

export function createGroupNodeMap(
  groups: GroupNode[],
): Map<string, GroupNode> {
  return new Map(groups.map((group) => [group.id, group]));
}

export function resolvePathToRoot(
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

export function resolveGroupMembershipClassification(input: {
  groupMap: Map<string, GroupNode>;
  rawGroupIds: string[];
}): GroupMembershipClassification {
  const groupIds = dedupeIds(input.rawGroupIds);
  const classification: GroupMembershipClassification = {
    customerScopeByGroupId: new Map<string, string | null>(),
    customerScopedIds: new Set<string>(),
  };

  for (const groupId of groupIds) {
    const path = resolvePathToRoot(input.groupMap, groupId);
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
  if (classification.customerScopedIds.size > 0 && !customerId) {
    throw new CounterpartyGroupRuleError(
      "customerId is required for customer-scoped groups",
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

export function withoutCustomerScopedGroups(input: {
  groupMap: Map<string, GroupNode>;
  rawGroupIds: string[];
}): string[] {
  const groupIds = dedupeIds(input.rawGroupIds);
  const classification = resolveGroupMembershipClassification({
    groupMap: input.groupMap,
    rawGroupIds: groupIds,
  });

  return groupIds.filter((groupId) => {
    const scopedCustomerId = classification.customerScopeByGroupId.get(groupId);
    return !scopedCustomerId;
  });
}

export function listGroupSubtreeIds(input: {
  groups: GroupNode[];
  rootGroupId: string;
}): string[] {
  if (!input.groups.some((group) => group.id === input.rootGroupId)) {
    return [];
  }

  const childrenByParentId = new Map<string, string[]>();
  for (const group of input.groups) {
    if (!group.parentId) {
      continue;
    }

    const children = childrenByParentId.get(group.parentId);
    if (children) {
      children.push(group.id);
      continue;
    }

    childrenByParentId.set(group.parentId, [group.id]);
  }

  const subtreeIds: string[] = [];
  const visited = new Set<string>();
  const stack = [input.rootGroupId];

  while (stack.length > 0) {
    const currentId = stack.pop()!;
    if (visited.has(currentId)) {
      continue;
    }

    visited.add(currentId);
    subtreeIds.push(currentId);
    stack.push(...(childrenByParentId.get(currentId) ?? []));
  }

  return subtreeIds;
}

export function planCustomerDetachment(input: {
  customerId: string;
  linkedCounterpartyIds: string[];
  memberships: {
    counterpartyId: string;
    groupId: string;
  }[];
  groups: GroupNode[];
}): {
  linkedCounterpartyIds: string[];
  removableGroupIds: string[];
} {
  const groupMap = createGroupNodeMap(input.groups);
  const removableGroupIds = new Set<string>();

  for (const membership of input.memberships) {
    const classification = resolveGroupMembershipClassification({
      groupMap,
      rawGroupIds: [membership.groupId],
    });
    const scopedCustomerId =
      classification.customerScopeByGroupId.get(membership.groupId) ?? null;
    if (scopedCustomerId === input.customerId) {
      removableGroupIds.add(membership.groupId);
    }
  }

  return {
    linkedCounterpartyIds: dedupeIds(input.linkedCounterpartyIds),
    removableGroupIds: Array.from(removableGroupIds),
  };
}
