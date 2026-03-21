import {
  dedupeStrings as dedupeIds,
  invariant,
} from "@bedrock/shared/core/domain";

export interface GroupHierarchyNodeSnapshot {
  id: string;
  code: string;
  parentId: string | null;
  customerId: string | null;
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
    invariant(
      this.customerScopedIds.size === 0 || customerId,
      "customerId is required for customer-scoped groups",
      {
        code: "counterparty.customer_required",
      },
    );

    if (!customerId) {
      return;
    }

    for (const scopedCustomerId of this.customerScopedIds) {
      invariant(
        scopedCustomerId === customerId,
        `customerId ${customerId} does not match scoped customer group ${scopedCustomerId}`,
        {
          code: "counterparty.customer_mismatch",
          meta: { customerId, scopedCustomerId },
        },
      );
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
    invariant(node, `Counterparty group not found: ${groupId}`, {
      code: "counterparty_group.not_found",
      meta: { groupId },
    });

    return node;
  }

  resolvePathToRoot(groupId: string): GroupHierarchyNodeSnapshot[] {
    const path: GroupHierarchyNodeSnapshot[] = [];
    const visited = new Set<string>();
    let current = this.require(groupId);

    while (current) {
      invariant(
        !visited.has(current.id),
        `Counterparty group hierarchy loop detected at group ${current.id}`,
        {
          code: "counterparty_group.loop_detected",
          meta: { groupId: current.id },
        },
      );

      visited.add(current.id);
      path.push(current);

      if (!current.parentId) {
        break;
      }

      current = this.require(current.parentId);
    }

    return path;
  }

  classifyMembership(
    groupIds: readonly string[],
  ): GroupMembershipClassification {
    const customerScopeByGroupId = new Map<string, string | null>();
    const customerScopedIds = new Set<string>();

    for (const groupId of dedupeIds(groupIds)) {
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

  withoutCustomerScopedGroups(groupIds: readonly string[]): string[] {
    const uniqueGroupIds = dedupeIds(groupIds);
    const classification = this.classifyMembership(uniqueGroupIds);

    return uniqueGroupIds.filter((groupId) => {
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

      const existing = childrenByParentId.get(node.parentId);
      if (existing) {
        existing.push(node.id);
      } else {
        childrenByParentId.set(node.parentId, [node.id]);
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
