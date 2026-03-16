import { Entity, normalizeRequiredText } from "@bedrock/shared/core/domain";
import { type RequisiteKind } from "@bedrock/shared/requisites";

import {
  OrganizationRequisiteDetails,
  type OrganizationRequisiteDetailsFields,
} from "./organization-requisite-details";

export interface OrganizationRequisiteSnapshot {
  id: string;
  organizationId: string;
  providerId: string;
  currencyId: string;
  kind: RequisiteKind;
  label: string;
  description: string | null;
  beneficiaryName: string | null;
  institutionName: string | null;
  institutionCountry: string | null;
  accountNo: string | null;
  corrAccount: string | null;
  iban: string | null;
  bic: string | null;
  swift: string | null;
  bankAddress: string | null;
  network: string | null;
  assetCode: string | null;
  address: string | null;
  memoTag: string | null;
  accountRef: string | null;
  subaccountRef: string | null;
  contact: string | null;
  notes: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}

export interface CreateOrganizationRequisiteProps extends OrganizationRequisiteDetailsFields {
  id: string;
  organizationId: string;
  providerId: string;
  currencyId: string;
  label: string;
  isDefault: boolean;
}

export interface UpdateOrganizationRequisiteProps {
  providerId: string;
  currencyId: string;
  kind: RequisiteKind;
  label: string;
  description: string | null;
  beneficiaryName: string | null;
  institutionName: string | null;
  institutionCountry: string | null;
  accountNo: string | null;
  corrAccount: string | null;
  iban: string | null;
  bic: string | null;
  swift: string | null;
  bankAddress: string | null;
  network: string | null;
  assetCode: string | null;
  address: string | null;
  memoTag: string | null;
  accountRef: string | null;
  subaccountRef: string | null;
  contact: string | null;
  notes: string | null;
  isDefault: boolean;
}

function normalizeSnapshot(
  snapshot: OrganizationRequisiteSnapshot,
): OrganizationRequisiteSnapshot {
  const details = OrganizationRequisiteDetails.create(snapshot);

  const normalized: OrganizationRequisiteSnapshot = {
    ...snapshot,
    label: normalizeRequiredText(
      snapshot.label,
      "organization_requisite.label_required",
      "label",
    ),
    ...details.toFields(),
  };

  return normalized;
}

export class OrganizationRequisite extends Entity<string> {
  private constructor(
    private readonly snapshot: OrganizationRequisiteSnapshot,
  ) {
    super(snapshot.id);
  }

  static create(
    input: CreateOrganizationRequisiteProps,
    now: Date,
  ): OrganizationRequisite {
    return new OrganizationRequisite(
      normalizeSnapshot({
        ...input,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      }),
    );
  }

  static reconstitute(
    snapshot: OrganizationRequisiteSnapshot,
  ): OrganizationRequisite {
    return new OrganizationRequisite(normalizeSnapshot(snapshot));
  }

  update(
    input: UpdateOrganizationRequisiteProps,
    now: Date,
  ): OrganizationRequisite {
    return new OrganizationRequisite(
      normalizeSnapshot({
        ...this.snapshot,
        providerId: input.providerId,
        currencyId: input.currencyId,
        kind: input.kind,
        label: input.label,
        description: input.description,
        beneficiaryName: input.beneficiaryName,
        institutionName: input.institutionName,
        institutionCountry: input.institutionCountry,
        accountNo: input.accountNo,
        corrAccount: input.corrAccount,
        iban: input.iban,
        bic: input.bic,
        swift: input.swift,
        bankAddress: input.bankAddress,
        network: input.network,
        assetCode: input.assetCode,
        address: input.address,
        memoTag: input.memoTag,
        accountRef: input.accountRef,
        subaccountRef: input.subaccountRef,
        contact: input.contact,
        notes: input.notes,
        isDefault: input.isDefault,
        updatedAt: now,
      }),
    );
  }

  archive(at: Date): OrganizationRequisite {
    return new OrganizationRequisite({
      ...this.snapshot,
      isDefault: false,
      archivedAt: at,
      updatedAt: at,
    });
  }

  isArchived(): boolean {
    return this.snapshot.archivedAt !== null;
  }

  sameState(other: OrganizationRequisite): boolean {
    return (
      JSON.stringify(this.toComparable()) ===
      JSON.stringify(other.toComparable())
    );
  }

  toSnapshot(): OrganizationRequisiteSnapshot {
    return { ...this.snapshot };
  }

  private toComparable() {
    const {
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...rest
    } = this.snapshot;

    return rest;
  }
}
