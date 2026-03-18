import {
  Entity,
  invariant,
  normalizeOptionalText,
  normalizeRequiredText,
} from "@bedrock/shared/core";

import {
  MANAGED_CUSTOMER_GROUP_PREFIX,
  isManagedCustomerGroupCode,
  type GroupHierarchyNodeSnapshot,
} from "./group-hierarchy";
import type { GroupHierarchy } from "./group-hierarchy";

export interface CounterpartyGroupSnapshot extends GroupHierarchyNodeSnapshot {
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCounterpartyGroupProps {
  id: string;
  code: string;
  name: string;
  description: string | null;
  parentId: string | null;
  customerId: string | null;
  isSystem: boolean;
}

export interface UpdateCounterpartyGroupProps {
  code: string;
  name: string;
  description: string | null;
  parentId: string | null;
  customerId: string | null;
}

function resolveScopedCustomerId(input: {
  parent: GroupHierarchyNodeSnapshot | null;
  customerId: string | null;
}): string | null {
  let customerId = input.customerId;

  if (!input.parent) {
    return customerId;
  }

  if (input.parent.customerId) {
    customerId = customerId ?? input.parent.customerId;

    invariant(
      customerId === input.parent.customerId,
      "counterparty_group.customer_mismatch",
      "Child group customerId must match scoped parent customerId",
      {
        customerId,
        parentCustomerId: input.parent.customerId,
      },
    );

    return customerId;
  }

  invariant(
    !customerId,
    "counterparty_group.customer_scope_invalid",
    "customerId is allowed only under customer-generated parent groups",
    { customerId, parentId: input.parent.id },
  );

  return null;
}

function normalizeCounterpartyGroupSnapshot(
  snapshot: CounterpartyGroupSnapshot,
): CounterpartyGroupSnapshot {
  return {
    ...snapshot,
    code: normalizeRequiredText(
      snapshot.code,
      "counterparty_group.code_required",
      "code",
    ),
    name: normalizeRequiredText(
      snapshot.name,
      "counterparty_group.name_required",
      "name",
    ),
    description: normalizeOptionalText(snapshot.description),
  };
}

export class CounterpartyGroup extends Entity<string> {
  private readonly snapshot: CounterpartyGroupSnapshot;

  private constructor(snapshot: CounterpartyGroupSnapshot) {
    super(snapshot.id);
    this.snapshot = normalizeCounterpartyGroupSnapshot(snapshot);
  }

  static create(
    input: CreateCounterpartyGroupProps,
    deps: {
      parent?: GroupHierarchyNodeSnapshot | null;
      now: Date;
    },
  ): CounterpartyGroup {
    invariant(
      !input.parentId || Boolean(deps.parent),
      "counterparty_group.not_found",
      `Counterparty group not found: ${input.parentId}`,
      { groupId: input.parentId },
    );

    invariant(
      !input.code.startsWith(MANAGED_CUSTOMER_GROUP_PREFIX),
      "counterparty_group.reserved_code",
      "Customer-generated group codes are reserved",
      { code: input.code },
    );

    const customerId = resolveScopedCustomerId({
      parent: input.parentId ? (deps.parent ?? null) : null,
      customerId: input.customerId,
    });

    invariant(
      input.parentId || !customerId,
      "counterparty_group.root_customer_forbidden",
      "Root custom groups cannot have customerId",
      { customerId },
    );

    return new CounterpartyGroup({
      id: input.id,
      code: input.code,
      name: input.name,
      description: input.description,
      parentId: input.parentId,
      customerId,
      isSystem: input.isSystem,
      createdAt: deps.now,
      updatedAt: deps.now,
    });
  }

  static fromSnapshot(snapshot: CounterpartyGroupSnapshot): CounterpartyGroup {
    return new CounterpartyGroup({ ...snapshot });
  }

  update(
    input: UpdateCounterpartyGroupProps,
    deps: {
      hierarchy: GroupHierarchy;
      now: Date;
    },
  ): CounterpartyGroup {
    const next = {
      ...this.snapshot,
      ...input,
    };
    const hasStateChanges =
      next.code !== this.snapshot.code ||
      next.name !== this.snapshot.name ||
      next.description !== this.snapshot.description ||
      next.parentId !== this.snapshot.parentId ||
      next.customerId !== this.snapshot.customerId;

    invariant(
      !(this.isManagedCustomerGroup() && hasStateChanges),
      "counterparty_group.system_immutable",
      "Customer-generated groups cannot be modified",
      { groupId: this.id },
    );

    if (next.code.startsWith(MANAGED_CUSTOMER_GROUP_PREFIX)) {
      invariant(
        this.isManagedCustomerGroup(),
        "counterparty_group.reserved_code",
        "Customer-generated group codes are reserved",
        { code: next.code },
      );
    }

    if (next.parentId) {
      invariant(
        next.parentId !== this.id,
        "counterparty_group.self_parent",
        "Group cannot be parent of itself",
        { groupId: this.id },
      );

      const parent = deps.hierarchy.require(next.parentId);
      invariant(
        !deps.hierarchy.wouldCreateCycle(this.id, next.parentId),
        "counterparty_group.descendant_parent",
        "Group cannot become a child of its own descendant",
        { groupId: this.id, parentId: next.parentId },
      );

      const nextCustomerId = resolveScopedCustomerId({
        parent,
        customerId: next.customerId,
      });

      return new CounterpartyGroup({
        ...next,
        parentId: next.parentId,
        customerId: nextCustomerId,
        updatedAt: deps.now,
      });
    }

    invariant(
      !next.customerId || this.isManagedCustomerGroup(),
      "counterparty_group.root_customer_forbidden",
      "Root custom groups cannot have customerId",
      { customerId: next.customerId },
    );

    return new CounterpartyGroup({
      ...next,
      parentId: null,
      customerId: next.customerId,
      updatedAt: deps.now,
    });
  }

  assertRemovable() {
    invariant(
      !(this.snapshot.isSystem || this.isManagedCustomerGroup()),
      "counterparty_group.delete_forbidden",
      `System counterparty group cannot be deleted: ${this.id}`,
      { groupId: this.id },
    );
  }

  isManagedCustomerGroup(): boolean {
    return isManagedCustomerGroupCode(this.snapshot.code);
  }

  sameState(other: CounterpartyGroup): boolean {
    return (
      this.snapshot.code === other.snapshot.code &&
      this.snapshot.name === other.snapshot.name &&
      this.snapshot.description === other.snapshot.description &&
      this.snapshot.parentId === other.snapshot.parentId &&
      this.snapshot.customerId === other.snapshot.customerId
    );
  }

  toSnapshot(): CounterpartyGroupSnapshot {
    return { ...this.snapshot };
  }
}
