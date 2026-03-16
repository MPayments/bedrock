import {
  dedupeIds,
  Entity,
  invariant,
  normalizeOptionalText,
  normalizeRequiredText,
} from "@bedrock/shared/core/domain";

import type { GroupHierarchy } from "./group-hierarchy";
import {
  PARTY_KIND_VALUES,
  parseOptionalCountryCode,
  type CountryCode,
  type PartyKind,
} from "./party-kind";

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
    "counterparty.kind_invalid",
    `Unsupported counterparty kind: ${normalized}`,
    { value: normalized },
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

export class Counterparty extends Entity<string> {
  private readonly snapshot: CounterpartySnapshot;

  private constructor(snapshot: CounterpartySnapshot) {
    super(snapshot.id);
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
      "counterparty.managed_group_required",
      "managed customer group is required for customer-linked counterparties",
      { customerId: input.customerId },
    );

    return new Counterparty({
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
  }

  static reconstitute(snapshot: CounterpartySnapshot): Counterparty {
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
      "counterparty.managed_group_required",
      "managed customer group is required for customer-linked counterparties",
      { customerId: input.customerId },
    );

    return new Counterparty({
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
