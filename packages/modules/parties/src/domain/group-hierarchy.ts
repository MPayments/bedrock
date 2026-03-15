import { dedupeIds, DomainError } from "@bedrock/shared/core/domain";

export interface GroupHierarchyNodeSnapshot {
  id: string;
  code: string;
  parentId: string | null;
  customerId: string | null;
}

export interface GroupMembershipClassificationSnapshot {
  customerScopeByGroupId: Map<string, string | null>;
  customerScopedIds: Set<string>;
}

export const MANAGED_CUSTOMER_GROUP_PREFIX = "customer:";

export function buildManagedCustomerGroupCode(customerId: string): string {
  return `${MANAGED_CUSTOMER_GROUP_PREFIX}${customerId}`;
}

export function isManagedCustomerGroupCode(code: string): boolean {
  return code.startsWith(MANAGED_CUSTOMER_GROUP_PREFIX);
}

export class GroupMembershipClassification {
  constructor(
    public readonly customerScopeByGroupId: Map<string, string | null>,
    public readonly customerScopedIds: Set<string>,
  ) {}

  static empty(): GroupMembershipClassification {
    return new GroupMembershipClassification(new Map(), new Set());
  }

  assertCustomerLink(customerId: string | null | undefined) {
    if (this.customerScopedIds.size > 0 && !customerId) {
      throw new DomainError(
        "counterparty.customer_required",
        "customerId is required for customer-scoped groups",
      );
    }

    if (!customerId) {
      return;
    }

    for (const scopedCustomerId of this.customerScopedIds) {
      if (scopedCustomerId !== customerId) {
        throw new DomainError(
          "counterparty.customer_mismatch",
          `customerId ${customerId} does not match scoped customer group ${scopedCustomerId}`,
          { customerId, scopedCustomerId },
        );
      }
    }
  }
}

export class GroupHierarchy {
  private readonly nodeMap: Map<string, GroupHierarchyNodeSnapshot>;

  private constructor(nodes: readonly GroupHierarchyNodeSnapshot[]) {
    this.nodeMap = new Map(nodes.map((node) => [node.id, { ...node }]));
  }

  static create(nodes: readonly GroupHierarchyNodeSnapshot[]): GroupHierarchy {
    return new GroupHierarchy(nodes);
  }

  get(groupId: string): GroupHierarchyNodeSnapshot | undefined {
    const node = this.nodeMap.get(groupId);
    return node ? { ...node } : undefined;
  }

  require(groupId: string): GroupHierarchyNodeSnapshot {
    const node = this.get(groupId);
    if (!node) {
      throw new DomainError(
        "counterparty_group.not_found",
        `Counterparty group not found: ${groupId}`,
        { groupId },
      );
    }

    return node;
  }

  resolvePathToRoot(groupId: string): GroupHierarchyNodeSnapshot[] {
    const path: GroupHierarchyNodeSnapshot[] = [];
    const visited = new Set<string>();
    let current = this.require(groupId);

    while (current) {
      if (visited.has(current.id)) {
        throw new DomainError(
          "counterparty_group.loop_detected",
          `Counterparty group hierarchy loop detected at group ${current.id}`,
          { groupId: current.id },
        );
      }

      visited.add(current.id);
      path.push(current);

      if (!current.parentId) {
        break;
      }

      current = this.require(current.parentId);
    }

    return path;
  }

  classifyMembership(rawGroupIds: readonly string[]): GroupMembershipClassification {
    const customerScopeByGroupId = new Map<string, string | null>();
    const customerScopedIds = new Set<string>();

    for (const groupId of dedupeIds(rawGroupIds)) {
      const path = this.resolvePathToRoot(groupId);
      const scopedCustomerId =
        path.find((node) => Boolean(node.customerId))?.customerId ?? null;

      customerScopeByGroupId.set(groupId, scopedCustomerId);
      if (scopedCustomerId) {
        customerScopedIds.add(scopedCustomerId);
      }
    }

    return new GroupMembershipClassification(
      customerScopeByGroupId,
      customerScopedIds,
    );
  }

  withoutCustomerScopedGroups(rawGroupIds: readonly string[]): string[] {
    const groupIds = dedupeIds(rawGroupIds);
    const classification = this.classifyMembership(groupIds);

    return groupIds.filter((groupId) => {
      const scopedCustomerId = classification.customerScopeByGroupId.get(groupId);
      return !scopedCustomerId;
    });
  }

  listSubtreeIds(rootGroupId: string): string[] {
    if (!this.nodeMap.has(rootGroupId)) {
      return [];
    }

    const childrenByParentId = new Map<string, string[]>();
    for (const node of this.nodeMap.values()) {
      if (!node.parentId) {
        continue;
      }

      const children = childrenByParentId.get(node.parentId);
      if (children) {
        children.push(node.id);
        continue;
      }

      childrenByParentId.set(node.parentId, [node.id]);
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
      stack.push(...(childrenByParentId.get(currentId) ?? []));
    }

    return subtreeIds;
  }

  wouldCreateCycle(groupId: string, nextParentId: string): boolean {
    return this.resolvePathToRoot(nextParentId).some((node) => node.id === groupId);
  }

  planCustomerDetachment(input: {
    customerId: string;
    linkedCounterpartyIds: readonly string[];
    memberships: readonly {
      counterpartyId: string;
      groupId: string;
    }[];
  }): {
    linkedCounterpartyIds: string[];
    removableGroupIds: string[];
  } {
    const removableGroupIds = new Set<string>();

    for (const membership of input.memberships) {
      const classification = this.classifyMembership([membership.groupId]);
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
}
