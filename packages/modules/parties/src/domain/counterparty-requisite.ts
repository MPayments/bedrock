import { Entity, normalizeRequiredText } from "@bedrock/shared/core/domain";
import { type RequisiteKind } from "@bedrock/shared/requisites";

import { CounterpartyRequisiteDetails } from "./counterparty-requisite-details";

export interface CounterpartyRequisiteSnapshot {
  id: string;
  counterpartyId: string;
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

export interface CreateCounterpartyRequisiteProps {
  id: string;
  counterpartyId: string;
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

export interface UpdateCounterpartyRequisiteProps {
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
  snapshot: CounterpartyRequisiteSnapshot,
): CounterpartyRequisiteSnapshot {
  const details = CounterpartyRequisiteDetails.create(snapshot);

  const normalized: CounterpartyRequisiteSnapshot = {
    ...snapshot,
    label: normalizeRequiredText(
      snapshot.label,
      "counterparty_requisite.label_required",
      "label",
    ),
    ...details.toFields(),
  };

  return normalized;
}

export class CounterpartyRequisite extends Entity<string> {
  private readonly snapshot: CounterpartyRequisiteSnapshot;

  private constructor(snapshot: CounterpartyRequisiteSnapshot) {
    super(snapshot.id);
    this.snapshot = normalizeSnapshot(snapshot);
  }

  static create(
    input: CreateCounterpartyRequisiteProps,
    now: Date,
  ): CounterpartyRequisite {
    return new CounterpartyRequisite({
      ...input,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    });
  }

  static fromSnapshot(
    snapshot: CounterpartyRequisiteSnapshot,
  ): CounterpartyRequisite {
    return new CounterpartyRequisite({ ...snapshot });
  }

  update(
    input: UpdateCounterpartyRequisiteProps,
    now: Date,
  ): CounterpartyRequisite {
    return new CounterpartyRequisite({
      ...this.snapshot,
      ...input,
      updatedAt: now,
    });
  }

  archive(at: Date): CounterpartyRequisite {
    return new CounterpartyRequisite({
      ...this.snapshot,
      isDefault: false,
      archivedAt: at,
      updatedAt: at,
    });
  }

  isArchived(): boolean {
    return this.snapshot.archivedAt !== null;
  }

  sameState(other: CounterpartyRequisite): boolean {
    return (
      JSON.stringify(this.toComparable()) ===
      JSON.stringify(other.toComparable())
    );
  }

  toSnapshot(): CounterpartyRequisiteSnapshot {
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
