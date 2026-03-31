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
import {
  COUNTERPARTY_RELATIONSHIP_KIND_VALUES,
  type CounterpartyRelationshipKind,
} from "./relationship-kind";

export type LocalizedText = {
  en?: string | null;
  ru?: string | null;
};

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

function normalizeLocalizedText(
  value: LocalizedText | null | undefined,
): LocalizedText | null {
  if (!value) {
    return null;
  }

  const normalized = {
    en: normalizeOptionalText(value.en),
    ru: normalizeOptionalText(value.ru),
  } satisfies LocalizedText;

  if (!normalized.en && !normalized.ru) {
    return null;
  }

  return normalized;
}

function sameLocalizedText(
  left: LocalizedText | null,
  right: LocalizedText | null,
): boolean {
  return (left?.en ?? null) === (right?.en ?? null) &&
    (left?.ru ?? null) === (right?.ru ?? null);
}

export interface CounterpartySnapshot {
  id: string;
  externalId: string | null;
  customerId: string | null;
  relationshipKind: CounterpartyRelationshipKind;
  shortName: string;
  fullName: string;
  orgNameI18n: LocalizedText | null;
  orgType: string | null;
  orgTypeI18n: LocalizedText | null;
  directorName: string | null;
  directorNameI18n: LocalizedText | null;
  position: string | null;
  positionI18n: LocalizedText | null;
  directorBasis: string | null;
  directorBasisI18n: LocalizedText | null;
  address: string | null;
  addressI18n: LocalizedText | null;
  email: string | null;
  phone: string | null;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  oktmo: string | null;
  okpo: string | null;
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
  relationshipKind: CounterpartyRelationshipKind;
  shortName: string;
  fullName: string;
  orgNameI18n: LocalizedText | null;
  orgType: string | null;
  orgTypeI18n: LocalizedText | null;
  directorName: string | null;
  directorNameI18n: LocalizedText | null;
  position: string | null;
  positionI18n: LocalizedText | null;
  directorBasis: string | null;
  directorBasisI18n: LocalizedText | null;
  address: string | null;
  addressI18n: LocalizedText | null;
  email: string | null;
  phone: string | null;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  oktmo: string | null;
  okpo: string | null;
  description: string | null;
  country: CountryCode | null;
  kind: PartyKind;
  groupIds: string[];
}

export interface UpdateCounterpartyProps {
  externalId: string | null;
  customerId: string | null;
  relationshipKind: CounterpartyRelationshipKind;
  shortName: string;
  fullName: string;
  orgNameI18n: LocalizedText | null;
  orgType: string | null;
  orgTypeI18n: LocalizedText | null;
  directorName: string | null;
  directorNameI18n: LocalizedText | null;
  position: string | null;
  positionI18n: LocalizedText | null;
  directorBasis: string | null;
  directorBasisI18n: LocalizedText | null;
  address: string | null;
  addressI18n: LocalizedText | null;
  email: string | null;
  phone: string | null;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  oktmo: string | null;
  okpo: string | null;
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

function normalizeRelationshipKind(
  value: CounterpartyRelationshipKind,
): CounterpartyRelationshipKind {
  const normalized = value;
  invariant(
    COUNTERPARTY_RELATIONSHIP_KIND_VALUES.includes(normalized),
    `Unsupported counterparty relationship kind: ${normalized}`,
    {
      code: "counterparty.relationship_kind_invalid",
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
    relationshipKind: normalizeRelationshipKind(snapshot.relationshipKind),
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
    orgNameI18n: normalizeLocalizedText(snapshot.orgNameI18n),
    orgType: normalizeOptionalText(snapshot.orgType),
    orgTypeI18n: normalizeLocalizedText(snapshot.orgTypeI18n),
    directorName: normalizeOptionalText(snapshot.directorName),
    directorNameI18n: normalizeLocalizedText(snapshot.directorNameI18n),
    position: normalizeOptionalText(snapshot.position),
    positionI18n: normalizeLocalizedText(snapshot.positionI18n),
    directorBasis: normalizeOptionalText(snapshot.directorBasis),
    directorBasisI18n: normalizeLocalizedText(snapshot.directorBasisI18n),
    address: normalizeOptionalText(snapshot.address),
    addressI18n: normalizeLocalizedText(snapshot.addressI18n),
    email: normalizeOptionalText(snapshot.email),
    phone: normalizeOptionalText(snapshot.phone),
    inn: normalizeOptionalText(snapshot.inn),
    kpp: normalizeOptionalText(snapshot.kpp),
    ogrn: normalizeOptionalText(snapshot.ogrn),
    oktmo: normalizeOptionalText(snapshot.oktmo),
    okpo: normalizeOptionalText(snapshot.okpo),
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
      relationshipKind: input.relationshipKind,
      shortName: input.shortName,
      fullName: input.fullName,
      orgNameI18n: input.orgNameI18n,
      orgType: input.orgType,
      orgTypeI18n: input.orgTypeI18n,
      directorName: input.directorName,
      directorNameI18n: input.directorNameI18n,
      position: input.position,
      positionI18n: input.positionI18n,
      directorBasis: input.directorBasis,
      directorBasisI18n: input.directorBasisI18n,
      address: input.address,
      addressI18n: input.addressI18n,
      email: input.email,
      phone: input.phone,
      inn: input.inn,
      kpp: input.kpp,
      ogrn: input.ogrn,
      oktmo: input.oktmo,
      okpo: input.okpo,
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
          relationshipKind: input.relationshipKind,
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
      relationshipKind: input.relationshipKind,
      updatedAt: deps.now,
    });

    if (!this.sameState(next)) {
      next.raiseDomainEvent({
        name: "counterparty.updated",
          payload: {
            counterpartyId: next.id,
            customerId: input.customerId,
            relationshipKind: input.relationshipKind,
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
        relationshipKind: "external",
        shortName: this.snapshot.shortName,
        fullName: this.snapshot.fullName,
        orgNameI18n: this.snapshot.orgNameI18n,
        orgType: this.snapshot.orgType,
        orgTypeI18n: this.snapshot.orgTypeI18n,
        directorName: this.snapshot.directorName,
        directorNameI18n: this.snapshot.directorNameI18n,
        position: this.snapshot.position,
        positionI18n: this.snapshot.positionI18n,
        directorBasis: this.snapshot.directorBasis,
        directorBasisI18n: this.snapshot.directorBasisI18n,
        address: this.snapshot.address,
        addressI18n: this.snapshot.addressI18n,
        email: this.snapshot.email,
        phone: this.snapshot.phone,
        inn: this.snapshot.inn,
        kpp: this.snapshot.kpp,
        ogrn: this.snapshot.ogrn,
        oktmo: this.snapshot.oktmo,
        okpo: this.snapshot.okpo,
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
      this.snapshot.relationshipKind === other.snapshot.relationshipKind &&
      this.snapshot.shortName === other.snapshot.shortName &&
      this.snapshot.fullName === other.snapshot.fullName &&
      sameLocalizedText(
        this.snapshot.orgNameI18n,
        other.snapshot.orgNameI18n,
      ) &&
      this.snapshot.orgType === other.snapshot.orgType &&
      sameLocalizedText(
        this.snapshot.orgTypeI18n,
        other.snapshot.orgTypeI18n,
      ) &&
      this.snapshot.directorName === other.snapshot.directorName &&
      sameLocalizedText(
        this.snapshot.directorNameI18n,
        other.snapshot.directorNameI18n,
      ) &&
      this.snapshot.position === other.snapshot.position &&
      sameLocalizedText(
        this.snapshot.positionI18n,
        other.snapshot.positionI18n,
      ) &&
      this.snapshot.directorBasis === other.snapshot.directorBasis &&
      sameLocalizedText(
        this.snapshot.directorBasisI18n,
        other.snapshot.directorBasisI18n,
      ) &&
      this.snapshot.address === other.snapshot.address &&
      sameLocalizedText(
        this.snapshot.addressI18n,
        other.snapshot.addressI18n,
      ) &&
      this.snapshot.email === other.snapshot.email &&
      this.snapshot.phone === other.snapshot.phone &&
      this.snapshot.inn === other.snapshot.inn &&
      this.snapshot.kpp === other.snapshot.kpp &&
      this.snapshot.ogrn === other.snapshot.ogrn &&
      this.snapshot.oktmo === other.snapshot.oktmo &&
      this.snapshot.okpo === other.snapshot.okpo &&
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
