import {
  Entity,
  normalizeRequiredText,
} from "@bedrock/shared/core/domain";
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
  description?: string | null;
  beneficiaryName?: string | null;
  institutionName?: string | null;
  institutionCountry?: string | null;
  accountNo?: string | null;
  corrAccount?: string | null;
  iban?: string | null;
  bic?: string | null;
  swift?: string | null;
  bankAddress?: string | null;
  network?: string | null;
  assetCode?: string | null;
  address?: string | null;
  memoTag?: string | null;
  accountRef?: string | null;
  subaccountRef?: string | null;
  contact?: string | null;
  notes?: string | null;
  isDefault: boolean;
}

export interface UpdateCounterpartyRequisiteProps {
  providerId: string;
  currencyId: string;
  kind: RequisiteKind;
  label?: string;
  description?: string | null;
  beneficiaryName?: string | null;
  institutionName?: string | null;
  institutionCountry?: string | null;
  accountNo?: string | null;
  corrAccount?: string | null;
  iban?: string | null;
  bic?: string | null;
  swift?: string | null;
  bankAddress?: string | null;
  network?: string | null;
  assetCode?: string | null;
  address?: string | null;
  memoTag?: string | null;
  accountRef?: string | null;
  subaccountRef?: string | null;
  contact?: string | null;
  notes?: string | null;
  isDefault: boolean;
}

function normalizeSnapshot(
  snapshot: Omit<CounterpartyRequisiteSnapshot, "description" | "beneficiaryName" |
    "institutionName" | "institutionCountry" | "accountNo" | "corrAccount" |
    "iban" | "bic" | "swift" | "bankAddress" | "network" | "assetCode" |
    "address" | "memoTag" | "accountRef" | "subaccountRef" | "contact" | "notes"> & {
      description?: string | null;
      beneficiaryName?: string | null;
      institutionName?: string | null;
      institutionCountry?: string | null;
      accountNo?: string | null;
      corrAccount?: string | null;
      iban?: string | null;
      bic?: string | null;
      swift?: string | null;
      bankAddress?: string | null;
      network?: string | null;
      assetCode?: string | null;
      address?: string | null;
      memoTag?: string | null;
      accountRef?: string | null;
      subaccountRef?: string | null;
      contact?: string | null;
      notes?: string | null;
    },
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
  private constructor(private readonly snapshot: CounterpartyRequisiteSnapshot) {
    super(snapshot.id);
  }

  static create(
    input: CreateCounterpartyRequisiteProps,
    now: Date,
  ): CounterpartyRequisite {
    return new CounterpartyRequisite(normalizeSnapshot({
      ...input,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    }));
  }

  static reconstitute(
    snapshot: CounterpartyRequisiteSnapshot,
  ): CounterpartyRequisite {
    return new CounterpartyRequisite(normalizeSnapshot(snapshot));
  }

  update(
    input: UpdateCounterpartyRequisiteProps,
    now: Date,
  ): CounterpartyRequisite {
    return new CounterpartyRequisite(normalizeSnapshot({
      ...this.snapshot,
      providerId: input.providerId,
      currencyId: input.currencyId,
      kind: input.kind,
      label: input.label ?? this.snapshot.label,
      description:
        input.description !== undefined
          ? input.description
          : this.snapshot.description,
      beneficiaryName:
        input.beneficiaryName !== undefined
          ? input.beneficiaryName
          : this.snapshot.beneficiaryName,
      institutionName:
        input.institutionName !== undefined
          ? input.institutionName
          : this.snapshot.institutionName,
      institutionCountry:
        input.institutionCountry !== undefined
          ? input.institutionCountry
          : this.snapshot.institutionCountry,
      accountNo:
        input.accountNo !== undefined ? input.accountNo : this.snapshot.accountNo,
      corrAccount:
        input.corrAccount !== undefined
          ? input.corrAccount
          : this.snapshot.corrAccount,
      iban: input.iban !== undefined ? input.iban : this.snapshot.iban,
      bic: input.bic !== undefined ? input.bic : this.snapshot.bic,
      swift: input.swift !== undefined ? input.swift : this.snapshot.swift,
      bankAddress:
        input.bankAddress !== undefined
          ? input.bankAddress
          : this.snapshot.bankAddress,
      network:
        input.network !== undefined ? input.network : this.snapshot.network,
      assetCode:
        input.assetCode !== undefined ? input.assetCode : this.snapshot.assetCode,
      address:
        input.address !== undefined ? input.address : this.snapshot.address,
      memoTag:
        input.memoTag !== undefined ? input.memoTag : this.snapshot.memoTag,
      accountRef:
        input.accountRef !== undefined
          ? input.accountRef
          : this.snapshot.accountRef,
      subaccountRef:
        input.subaccountRef !== undefined
          ? input.subaccountRef
          : this.snapshot.subaccountRef,
      contact:
        input.contact !== undefined ? input.contact : this.snapshot.contact,
      notes: input.notes !== undefined ? input.notes : this.snapshot.notes,
      isDefault: input.isDefault,
      updatedAt: now,
    }));
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
    return JSON.stringify(this.toComparable()) === JSON.stringify(other.toComparable());
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
