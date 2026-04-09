import { Entity, normalizeRequiredText } from "@bedrock/shared/core";
import { normalizeOptionalText } from "@bedrock/shared/core/domain";

import { RequisiteOwner } from "./owner";
import type { RequisiteKind } from "./requisite-kind";

export interface RequisiteSnapshot {
  id: string;
  ownerType: "organization" | "counterparty";
  ownerId: string;
  providerId: string;
  providerBranchId: string | null;
  currencyId: string;
  kind: RequisiteKind;
  label: string;
  beneficiaryName: string | null;
  beneficiaryNameLocal: string | null;
  beneficiaryAddress: string | null;
  paymentPurposeTemplate: string | null;
  notes: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}

export interface CreateRequisiteProps {
  id: string;
  ownerType: "organization" | "counterparty";
  ownerId: string;
  providerId: string;
  providerBranchId: string | null;
  currencyId: string;
  kind: RequisiteKind;
  label: string;
  beneficiaryName: string | null;
  beneficiaryNameLocal: string | null;
  beneficiaryAddress: string | null;
  paymentPurposeTemplate: string | null;
  notes: string | null;
  isDefault: boolean;
}

export interface UpdateRequisiteProps {
  providerId: string;
  providerBranchId: string | null;
  currencyId: string;
  kind: RequisiteKind;
  label: string;
  beneficiaryName: string | null;
  beneficiaryNameLocal: string | null;
  beneficiaryAddress: string | null;
  paymentPurposeTemplate: string | null;
  notes: string | null;
  isDefault: boolean;
}

function normalizeSnapshot(snapshot: RequisiteSnapshot): RequisiteSnapshot {
  const owner = RequisiteOwner.create({
    type: snapshot.ownerType,
    id: snapshot.ownerId,
  });

  return {
    ...snapshot,
    ownerType: owner.type,
    ownerId: owner.id,
    label: normalizeRequiredText(
      snapshot.label,
      "requisite.label_required",
      "label",
    ),
    beneficiaryName: normalizeOptionalText(snapshot.beneficiaryName),
    beneficiaryNameLocal: normalizeOptionalText(snapshot.beneficiaryNameLocal),
    beneficiaryAddress: normalizeOptionalText(snapshot.beneficiaryAddress),
    paymentPurposeTemplate: normalizeOptionalText(
      snapshot.paymentPurposeTemplate,
    ),
    notes: normalizeOptionalText(snapshot.notes),
    providerBranchId: snapshot.providerBranchId ?? null,
  };
}

export class Requisite extends Entity<string> {
  private constructor(private readonly snapshot: RequisiteSnapshot) {
    super({ id: snapshot.id, props: {} });
  }

  static create(input: CreateRequisiteProps, now: Date): Requisite {
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
        ...input,
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

  withDefaultState(isDefault: boolean, now: Date): Requisite {
    if (this.snapshot.isDefault === isDefault) {
      return this;
    }

    return new Requisite({
      ...this.snapshot,
      isDefault,
      updatedAt: now,
    });
  }

  isArchived(): boolean {
    return this.snapshot.archivedAt !== null;
  }

  isDefault(): boolean {
    return this.snapshot.isDefault;
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
