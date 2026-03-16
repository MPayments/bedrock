import { Entity, normalizeRequiredText } from "@bedrock/shared/core/domain";

import { RequisiteOwner } from "./owner";
import { RequisiteDetails, type RequisiteDetailsFields } from "./requisite-details";
import type { RequisiteKind } from "./requisite-kind";

export interface RequisiteSnapshot {
  id: string;
  ownerType: "organization" | "counterparty";
  ownerId: string;
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

export interface CreateRequisiteProps extends RequisiteDetailsFields {
  id: string;
  ownerType: "organization" | "counterparty";
  ownerId: string;
  providerId: string;
  currencyId: string;
  label: string;
  isDefault: boolean;
}

export interface UpdateRequisiteProps {
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
  snapshot: RequisiteSnapshot,
): RequisiteSnapshot {
  const details = RequisiteDetails.create(snapshot);
  const owner = RequisiteOwner.create({
    type: snapshot.ownerType,
    id: snapshot.ownerId,
  });

  const normalized: RequisiteSnapshot = {
    ...snapshot,
    ownerType: owner.type,
    ownerId: owner.id,
    label: normalizeRequiredText(
      snapshot.label,
      "requisite.label_required",
      "label",
    ),
    ...details.toFields(),
  };

  return normalized;
}

export class Requisite extends Entity<string> {
  private constructor(private readonly snapshot: RequisiteSnapshot) {
    super(snapshot.id);
  }

  static create(
    input: CreateRequisiteProps,
    now: Date,
  ): Requisite {
    return new Requisite(
      normalizeSnapshot({
        ...input,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      }),
    );
  }

  static fromSnapshot(snapshot: RequisiteSnapshot): Requisite {
    return new Requisite(normalizeSnapshot(snapshot));
  }

  update(input: UpdateRequisiteProps, now: Date): Requisite {
    return new Requisite(
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

  archive(at: Date): Requisite {
    return new Requisite({
      ...this.snapshot,
      isDefault: false,
      archivedAt: at,
      updatedAt: at,
    });
  }

  isArchived(): boolean {
    return this.snapshot.archivedAt !== null;
  }

  sameState(other: Requisite): boolean {
    return (
      JSON.stringify(this.toComparable()) ===
      JSON.stringify(other.toComparable())
    );
  }

  toSnapshot(): RequisiteSnapshot {
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
