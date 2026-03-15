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
  shortName: string;
  fullName: string;
  kind?: PartyKind;
  country?: string | null;
  externalId?: string | null;
  description?: string | null;
  customerId?: string | null;
  groupIds?: string[];
}

export interface UpdateCounterpartyProps {
  shortName?: string;
  fullName?: string;
  kind?: PartyKind;
  country?: string | null;
  externalId?: string | null;
  description?: string | null;
  customerId?: string | null;
  groupIds?: string[];
}

function normalizePartyKind(value: PartyKind | undefined): PartyKind {
  const normalized = value ?? "legal_entity";
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

export class Counterparty extends Entity<string> {
  private constructor(private readonly snapshot: CounterpartySnapshot) {
    super(snapshot.id);
  }

  static create(
    input: CreateCounterpartyProps,
    deps: {
      hierarchy: GroupHierarchy;
      managedGroupId?: string | null;
      now: Date;
    },
  ): Counterparty {
    const customerId = input.customerId ?? null;
    invariant(
      !customerId || deps.managedGroupId,
      "counterparty.managed_group_required",
      "managed customer group is required for customer-linked counterparties",
      { customerId },
    );

    return new Counterparty({
      id: input.id,
      externalId: normalizeOptionalText(input.externalId),
      customerId,
      shortName: normalizeRequiredText(
        input.shortName,
        "counterparty.short_name_required",
        "shortName",
      ),
      fullName: normalizeRequiredText(
        input.fullName,
        "counterparty.full_name_required",
        "fullName",
      ),
      description: normalizeOptionalText(input.description),
      country: parseOptionalCountryCode(input.country),
      kind: normalizePartyKind(input.kind),
      groupIds: resolveGroups({
        groupIds: input.groupIds ?? [],
        hierarchy: deps.hierarchy,
        customerId,
        managedGroupId: deps.managedGroupId ?? null,
      }),
      createdAt: deps.now,
      updatedAt: deps.now,
    });
  }

  static reconstitute(snapshot: CounterpartySnapshot): Counterparty {
    return new Counterparty({
      ...snapshot,
      externalId: normalizeOptionalText(snapshot.externalId),
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
    });
  }

  update(
    input: UpdateCounterpartyProps,
    deps: {
      hierarchy: GroupHierarchy;
      managedGroupId?: string | null;
      now: Date;
    },
  ): Counterparty {
    const nextCustomerId =
      input.customerId !== undefined
        ? input.customerId
        : this.snapshot.customerId;

    const explicitGroupIds =
      input.groupIds !== undefined
        ? input.groupIds
        : input.customerId !== undefined
          ? deps.hierarchy.withoutCustomerScopedGroups(this.snapshot.groupIds)
          : this.snapshot.groupIds;

    invariant(
      !nextCustomerId || deps.managedGroupId,
      "counterparty.managed_group_required",
      "managed customer group is required for customer-linked counterparties",
      { customerId: nextCustomerId },
    );

    return new Counterparty({
      ...this.snapshot,
      externalId:
        input.externalId !== undefined
          ? normalizeOptionalText(input.externalId)
          : this.snapshot.externalId,
      customerId: nextCustomerId,
      shortName:
        input.shortName !== undefined
          ? normalizeRequiredText(
              input.shortName,
              "counterparty.short_name_required",
              "shortName",
            )
          : this.snapshot.shortName,
      fullName:
        input.fullName !== undefined
          ? normalizeRequiredText(
              input.fullName,
              "counterparty.full_name_required",
              "fullName",
            )
          : this.snapshot.fullName,
      description:
        input.description !== undefined
          ? normalizeOptionalText(input.description)
          : this.snapshot.description,
      country:
        input.country !== undefined
          ? parseOptionalCountryCode(input.country)
          : this.snapshot.country,
      kind:
        input.kind !== undefined
          ? normalizePartyKind(input.kind)
          : this.snapshot.kind,
      groupIds: resolveGroups({
        groupIds: explicitGroupIds,
        hierarchy: deps.hierarchy,
        customerId: nextCustomerId,
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
