import {
  AggregateRoot,
  dedupeStrings as dedupeIds,
  invariant,
} from "@bedrock/shared/core/domain";

import type { GroupHierarchy } from "../../shared/domain/group-hierarchy";
import {
  PARTY_KIND_VALUES,
  parseOptionalCountryCode,
  type CountryCode,
  type PartyKind,
} from "../../shared/domain/party-kind";

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

export interface CounterpartySnapshot {
  id: string;
  externalId: string | null;
  customerId: string | null;
  shortName: string;
  fullName: string;
  description: string | null;
  country: CountryCode | null;
  kind: PartyKind;
  groupIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCounterpartyProps {
  id: string;
  externalId: string | null;
  customerId: string | null;
  shortName: string;
  fullName: string;
  description: string | null;
  country: CountryCode | null;
  kind: PartyKind;
  groupIds: string[];
}

export interface UpdateCounterpartyProps {
  externalId: string | null;
  customerId: string | null;
  shortName: string;
  fullName: string;
  description: string | null;
  country: CountryCode | null;
  kind: PartyKind;
  groupIds: string[];
}

function normalizePartyKind(value: PartyKind): PartyKind {
  const normalized = value;
  invariant(
    PARTY_KIND_VALUES.includes(normalized),
    `Unsupported counterparty kind: ${normalized}`,
    {
      code: "counterparty.kind_invalid",
      meta: { value: normalized },
    },
  );

  return normalized;
}

function resolveGroups(input: {
  groupIds: readonly string[];
  hierarchy: GroupHierarchy;
  customerId: string | null;
  managedGroupId: string | null;
}): string[] {
  const groupIds = dedupeIds(input.groupIds);
  const nextGroupIds =
    input.customerId && input.managedGroupId
      ? dedupeIds([...groupIds, input.managedGroupId])
      : groupIds;

  const classification = input.hierarchy.classifyMembership(nextGroupIds);
  classification.assertCustomerLink(input.customerId);

  return nextGroupIds;
}

function normalizeCounterpartySnapshot(
  snapshot: CounterpartySnapshot,
): CounterpartySnapshot {
  return {
    ...snapshot,
    externalId: normalizeOptionalText(snapshot.externalId),
    customerId: snapshot.customerId ?? null,
    shortName: normalizeRequiredText(
      snapshot.shortName,
      "counterparty.short_name_required",
      "shortName",
    ),
    fullName: normalizeRequiredText(
      snapshot.fullName,
      "counterparty.full_name_required",
      "fullName",
    ),
    description: normalizeOptionalText(snapshot.description),
    country: parseOptionalCountryCode(snapshot.country),
    kind: normalizePartyKind(snapshot.kind),
    groupIds: dedupeIds(snapshot.groupIds),
  };
}

export class Counterparty extends AggregateRoot<string> {
  private readonly snapshot: CounterpartySnapshot;

  private constructor(snapshot: CounterpartySnapshot) {
    super({ id: snapshot.id, props: {} });
    this.snapshot = normalizeCounterpartySnapshot(snapshot);
  }

  static create(
    input: CreateCounterpartyProps,
    deps: {
      hierarchy: GroupHierarchy;
      managedGroupId?: string | null;
      now: Date;
    },
  ): Counterparty {
    invariant(
      !input.customerId || deps.managedGroupId,
      "managed customer group is required for customer-linked counterparties",
      {
        code: "counterparty.managed_group_required",
        meta: { customerId: input.customerId },
      },
    );

    const counterparty = new Counterparty({
      id: input.id,
      externalId: input.externalId,
      customerId: input.customerId,
      shortName: input.shortName,
      fullName: input.fullName,
      description: input.description,
      country: input.country,
      kind: input.kind,
      groupIds: resolveGroups({
        groupIds: input.groupIds,
        hierarchy: deps.hierarchy,
        customerId: input.customerId,
        managedGroupId: deps.managedGroupId ?? null,
      }),
      createdAt: deps.now,
      updatedAt: deps.now,
    });

    counterparty.raiseDomainEvent({
      name: "counterparty.created",
      payload: {
        counterpartyId: counterparty.id,
        customerId: input.customerId,
      },
    });

    return counterparty;
  }

  static fromSnapshot(snapshot: CounterpartySnapshot): Counterparty {
    return new Counterparty({ ...snapshot });
  }

  update(
    input: UpdateCounterpartyProps,
    deps: {
      hierarchy: GroupHierarchy;
      managedGroupId?: string | null;
      now: Date;
    },
  ): Counterparty {
    invariant(
      !input.customerId || deps.managedGroupId,
      "managed customer group is required for customer-linked counterparties",
      {
        code: "counterparty.managed_group_required",
        meta: { customerId: input.customerId },
      },
    );

    const next = new Counterparty({
      ...this.snapshot,
      ...input,
      groupIds: resolveGroups({
        groupIds: input.groupIds,
        hierarchy: deps.hierarchy,
        customerId: input.customerId,
        managedGroupId: deps.managedGroupId ?? null,
      }),
      updatedAt: deps.now,
    });

    if (!this.sameState(next)) {
      next.raiseDomainEvent({
        name: "counterparty.updated",
        payload: {
          counterpartyId: next.id,
          customerId: input.customerId,
        },
      });
    }

    return next;
  }

  detachCustomer(input: {
    hierarchy: GroupHierarchy;
    now: Date;
  }): Counterparty {
    return this.update(
      {
        externalId: this.snapshot.externalId,
        customerId: null,
        shortName: this.snapshot.shortName,
        fullName: this.snapshot.fullName,
        description: this.snapshot.description,
        country: this.snapshot.country,
        kind: this.snapshot.kind,
        groupIds: input.hierarchy.withoutCustomerScopedGroups(
          this.snapshot.groupIds,
        ),
      },
      {
        hierarchy: input.hierarchy,
        managedGroupId: null,
        now: input.now,
      },
    );
  }

  sameState(other: Counterparty): boolean {
    return (
      this.snapshot.externalId === other.snapshot.externalId &&
      this.snapshot.customerId === other.snapshot.customerId &&
      this.snapshot.shortName === other.snapshot.shortName &&
      this.snapshot.fullName === other.snapshot.fullName &&
      this.snapshot.description === other.snapshot.description &&
      this.snapshot.country === other.snapshot.country &&
      this.snapshot.kind === other.snapshot.kind &&
      this.snapshot.groupIds.length === other.snapshot.groupIds.length &&
      this.snapshot.groupIds.every(
        (groupId, index) => groupId === other.snapshot.groupIds[index],
      )
    );
  }

  toSnapshot(): CounterpartySnapshot {
    return {
      ...this.snapshot,
      groupIds: [...this.snapshot.groupIds],
    };
  }
}
