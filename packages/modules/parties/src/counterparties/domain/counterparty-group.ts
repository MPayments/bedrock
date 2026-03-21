import { AggregateRoot, invariant } from "@bedrock/shared/core/domain";

import type {
  GroupHierarchy,
  GroupHierarchyNodeSnapshot,
} from "../../shared/domain/group-hierarchy";
import {
  buildManagedCustomerGroupCode,
  MANAGED_CUSTOMER_GROUP_DESCRIPTION,
  MANAGED_CUSTOMER_GROUP_PREFIX,
  isManagedCustomerGroupCode,
} from "../../shared/domain/managed-customer-group";

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRequiredText(
  value: string,
  code: string,
  field: string,
): string {
  const trimmed = value.trim();
  invariant(trimmed.length > 0, `${field} is required`, {
    code,
    meta: { field },
  });

  return trimmed;
}

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

function assertManagedCustomerGroupShape(
  snapshot: CounterpartyGroupSnapshot,
): void {
  if (!isManagedCustomerGroupCode(snapshot.code)) {
    return;
  }

  invariant(
    Boolean(snapshot.customerId),
    "Managed customer groups must belong to a customer",
    {
      code: "counterparty_group.managed_customer_required",
      meta: { groupId: snapshot.id },
    },
  );

  invariant(
    snapshot.parentId === null,
    "Managed customer groups must be root groups",
    {
      code: "counterparty_group.managed_root_required",
      meta: {
        groupId: snapshot.id,
        parentId: snapshot.parentId,
      },
    },
  );
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
      "Child group customerId must match scoped parent customerId",
      {
        code: "counterparty_group.customer_mismatch",
        meta: {
          customerId,
          parentCustomerId: input.parent.customerId,
        },
      },
    );

    return customerId;
  }

  invariant(
    !customerId,
    "customerId is allowed only under customer-generated parent groups",
    {
      code: "counterparty_group.customer_scope_invalid",
      meta: { customerId, parentId: input.parent.id },
    },
  );

  return null;
}

function normalizeCounterpartyGroupSnapshot(
  snapshot: CounterpartyGroupSnapshot,
): CounterpartyGroupSnapshot {
  const normalized = {
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

  assertManagedCustomerGroupShape(normalized);

  return normalized;
}

export class CounterpartyGroup extends AggregateRoot<string> {
  private readonly snapshot: CounterpartyGroupSnapshot;

  private constructor(snapshot: CounterpartyGroupSnapshot) {
    super({ id: snapshot.id, props: {} });
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
      `Counterparty group not found: ${input.parentId}`,
      {
        code: "counterparty_group.not_found",
        meta: { groupId: input.parentId },
      },
    );

    invariant(
      !input.isSystem,
      "System counterparty groups must be created through dedicated factories",
      {
        code: "counterparty_group.system_factory_required",
      },
    );

    invariant(
      !input.code.startsWith(MANAGED_CUSTOMER_GROUP_PREFIX),
      "Customer-generated group codes are reserved",
      {
        code: "counterparty_group.reserved_code",
        meta: { code: input.code },
      },
    );

    const customerId = resolveScopedCustomerId({
      parent: input.parentId ? (deps.parent ?? null) : null,
      customerId: input.customerId,
    });

    invariant(
      input.parentId || !customerId,
      "Root custom groups cannot have customerId",
      {
        code: "counterparty_group.root_customer_forbidden",
        meta: { customerId },
      },
    );

    const group = new CounterpartyGroup({
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

    group.raiseDomainEvent({
      name: "counterparty_group.created",
      payload: {
        groupId: group.id,
        parentId: input.parentId,
        customerId,
      },
    });

    return group;
  }

  static createManagedCustomerGroup(
    input: {
      id: string;
      customerId: string;
      displayName: string;
    },
    deps: {
      now: Date;
    },
  ): CounterpartyGroup {
    const group = new CounterpartyGroup({
      id: input.id,
      code: buildManagedCustomerGroupCode(input.customerId),
      name: input.displayName,
      description: MANAGED_CUSTOMER_GROUP_DESCRIPTION,
      parentId: null,
      customerId: input.customerId,
      isSystem: false,
      createdAt: deps.now,
      updatedAt: deps.now,
    });

    group.raiseDomainEvent({
      name: "counterparty_group.created",
      payload: {
        groupId: group.id,
        parentId: null,
        customerId: input.customerId,
      },
    });

    return group;
  }

  static fromSnapshot(snapshot: CounterpartyGroupSnapshot): CounterpartyGroup {
    return new CounterpartyGroup({ ...snapshot });
  }

  syncManagedCustomerDisplayName(input: {
    displayName: string;
    now: Date;
  }): CounterpartyGroup {
    invariant(
      this.isManagedCustomerGroup(),
      "Only managed customer groups can be synced from customer records",
      {
        code: "counterparty_group.managed_sync_forbidden",
        meta: { groupId: this.id },
      },
    );

    const group = new CounterpartyGroup({
      ...this.snapshot,
      name: input.displayName,
      description:
        this.snapshot.description ?? MANAGED_CUSTOMER_GROUP_DESCRIPTION,
      updatedAt: input.now,
    });

    if (this.sameState(group)) {
      return this;
    }

    group.raiseDomainEvent({
      name: "counterparty_group.updated",
      payload: {
        groupId: group.id,
        parentId: null,
        customerId: group.toSnapshot().customerId,
      },
    });

    return group;
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
      "Customer-generated groups cannot be modified",
      {
        code: "counterparty_group.system_immutable",
        meta: { groupId: this.id },
      },
    );

    if (next.code.startsWith(MANAGED_CUSTOMER_GROUP_PREFIX)) {
      invariant(
        this.isManagedCustomerGroup(),
        "Customer-generated group codes are reserved",
        {
          code: "counterparty_group.reserved_code",
          meta: { code: next.code },
        },
      );
    }

    if (next.parentId) {
      invariant(next.parentId !== this.id, "Group cannot be parent of itself", {
        code: "counterparty_group.self_parent",
        meta: { groupId: this.id },
      });

      const parent = deps.hierarchy.require(next.parentId);
      invariant(
        !deps.hierarchy.wouldCreateCycle(this.id, next.parentId),
        "Group cannot become a child of its own descendant",
        {
          code: "counterparty_group.descendant_parent",
          meta: { groupId: this.id, parentId: next.parentId },
        },
      );

      const nextCustomerId = resolveScopedCustomerId({
        parent,
        customerId: next.customerId,
      });

      const group = new CounterpartyGroup({
        ...next,
        customerId: nextCustomerId,
        updatedAt: deps.now,
      });

      if (!this.sameState(group)) {
        group.raiseDomainEvent({
          name: "counterparty_group.updated",
          payload: {
            groupId: group.id,
            parentId: group.toSnapshot().parentId,
            customerId: group.toSnapshot().customerId,
          },
        });
      }

      return group;
    }

    invariant(
      !next.customerId || this.isManagedCustomerGroup(),
      "Root custom groups cannot have customerId",
      {
        code: "counterparty_group.root_customer_forbidden",
        meta: { customerId: next.customerId },
      },
    );

    const group = new CounterpartyGroup({
      ...next,
      parentId: null,
      updatedAt: deps.now,
    });

    if (!this.sameState(group)) {
      group.raiseDomainEvent({
        name: "counterparty_group.updated",
        payload: {
          groupId: group.id,
          parentId: null,
          customerId: group.toSnapshot().customerId,
        },
      });
    }

    return group;
  }

  reparent(input: {
    hierarchy: GroupHierarchy;
    now: Date;
    parentId: string | null;
  }): CounterpartyGroup {
    return this.update(
      {
        code: this.snapshot.code,
        name: this.snapshot.name,
        description: this.snapshot.description,
        parentId: input.parentId,
        customerId: this.snapshot.customerId,
      },
      {
        hierarchy: input.hierarchy,
        now: input.now,
      },
    );
  }

  assertRemovable() {
    invariant(
      !(this.snapshot.isSystem || this.isManagedCustomerGroup()),
      `System counterparty group cannot be deleted: ${this.id}`,
      {
        code: "counterparty_group.delete_forbidden",
        meta: { groupId: this.id },
      },
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
      this.snapshot.customerId === other.snapshot.customerId &&
      this.snapshot.isSystem === other.snapshot.isSystem
    );
  }

  toSnapshot(): CounterpartyGroupSnapshot {
    return { ...this.snapshot };
  }
}
