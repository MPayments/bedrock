import { Entity, invariant } from "@bedrock/shared/core/domain";

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
  description?: string | null;
  parentId?: string | null;
  customerId?: string | null;
  isSystem?: boolean;
}

export interface UpdateCounterpartyGroupProps {
  code?: string;
  name?: string;
  description?: string | null;
  parentId?: string | null;
  customerId?: string | null;
}

function normalizeRequiredText(
  value: string,
  code: string,
  field: string,
): string {
  const normalized = value.trim();
  invariant(normalized.length > 0, code, `${field} is required`, {
    field,
    value,
  });

  return normalized;
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  if (value == null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
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

export class CounterpartyGroup extends Entity<string> {
  private constructor(private readonly snapshot: CounterpartyGroupSnapshot) {
    super(snapshot.id);
  }

  static create(
    input: CreateCounterpartyGroupProps,
    deps: {
      parent?: GroupHierarchyNodeSnapshot | null;
      now: Date;
    },
  ): CounterpartyGroup {
    const code = normalizeRequiredText(
      input.code,
      "counterparty_group.code_required",
      "code",
    );
    const name = normalizeRequiredText(
      input.name,
      "counterparty_group.name_required",
      "name",
    );
    const parentId = input.parentId ?? null;

    invariant(
      !parentId || Boolean(deps.parent),
      "counterparty_group.not_found",
      `Counterparty group not found: ${parentId}`,
      { groupId: parentId },
    );

    invariant(
      !code.startsWith(MANAGED_CUSTOMER_GROUP_PREFIX),
      "counterparty_group.reserved_code",
      "Customer-generated group codes are reserved",
      { code },
    );

    const customerId = resolveScopedCustomerId({
      parent: parentId ? (deps.parent ?? null) : null,
      customerId: input.customerId ?? null,
    });

    invariant(
      parentId || !customerId,
      "counterparty_group.root_customer_forbidden",
      "Root custom groups cannot have customerId",
      { customerId },
    );

    return new CounterpartyGroup({
      id: input.id,
      code,
      name,
      description: normalizeOptionalText(input.description),
      parentId,
      customerId,
      isSystem: input.isSystem ?? false,
      createdAt: deps.now,
      updatedAt: deps.now,
    });
  }

  static reconstitute(snapshot: CounterpartyGroupSnapshot): CounterpartyGroup {
    return new CounterpartyGroup({
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
    });
  }

  update(
    input: UpdateCounterpartyGroupProps,
    deps: {
      hierarchy: GroupHierarchy;
      now: Date;
    },
  ): CounterpartyGroup {
    const hasRequestedChanges =
      input.code !== undefined ||
      input.name !== undefined ||
      input.description !== undefined ||
      input.parentId !== undefined ||
      input.customerId !== undefined;

    invariant(
      !(this.isManagedCustomerGroup() && hasRequestedChanges),
      "counterparty_group.system_immutable",
      "Customer-generated groups cannot be modified",
      { groupId: this.id },
    );

    const nextParentId =
      input.parentId !== undefined ? input.parentId : this.snapshot.parentId;
    const currentCustomerId = this.snapshot.customerId;
    const requestedCustomerId =
      input.customerId !== undefined ? input.customerId : currentCustomerId;

    if (input.code?.startsWith(MANAGED_CUSTOMER_GROUP_PREFIX)) {
      invariant(
        this.isManagedCustomerGroup(),
        "counterparty_group.reserved_code",
        "Customer-generated group codes are reserved",
        { code: input.code },
      );
    }

    if (nextParentId) {
      invariant(
        nextParentId !== this.id,
        "counterparty_group.self_parent",
        "Group cannot be parent of itself",
        { groupId: this.id },
      );

      const parent = deps.hierarchy.require(nextParentId);
      invariant(
        !deps.hierarchy.wouldCreateCycle(this.id, nextParentId),
        "counterparty_group.descendant_parent",
        "Group cannot become a child of its own descendant",
        { groupId: this.id, parentId: nextParentId },
      );

      const nextCustomerId = resolveScopedCustomerId({
        parent,
        customerId: requestedCustomerId,
      });

      return new CounterpartyGroup({
        ...this.snapshot,
        code:
          input.code !== undefined
            ? normalizeRequiredText(
                input.code,
                "counterparty_group.code_required",
                "code",
              )
            : this.snapshot.code,
        name:
          input.name !== undefined
            ? normalizeRequiredText(
                input.name,
                "counterparty_group.name_required",
                "name",
              )
            : this.snapshot.name,
        description:
          input.description !== undefined
            ? normalizeOptionalText(input.description)
            : this.snapshot.description,
        parentId: nextParentId,
        customerId: nextCustomerId,
        updatedAt: deps.now,
      });
    }

    invariant(
      !requestedCustomerId || this.isManagedCustomerGroup(),
      "counterparty_group.root_customer_forbidden",
      "Root custom groups cannot have customerId",
      { customerId: requestedCustomerId },
    );

    return new CounterpartyGroup({
      ...this.snapshot,
      code:
        input.code !== undefined
          ? normalizeRequiredText(
              input.code,
              "counterparty_group.code_required",
              "code",
            )
          : this.snapshot.code,
      name:
        input.name !== undefined
          ? normalizeRequiredText(
              input.name,
              "counterparty_group.name_required",
              "name",
            )
          : this.snapshot.name,
      description:
        input.description !== undefined
          ? normalizeOptionalText(input.description)
          : this.snapshot.description,
      parentId: null,
      customerId: requestedCustomerId ?? null,
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
