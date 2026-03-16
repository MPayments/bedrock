import { resolvePatchValue } from "@bedrock/shared/core";

import type {
  CreateRequisiteProps,
  RequisiteSnapshot,
  UpdateRequisiteProps,
} from "../../domain/requisite";

export function resolveCreateRequisiteProps(input: {
  id: string;
  ownerType: "organization" | "counterparty";
  ownerId: string;
  values: {
    providerId: string;
    currencyId: string;
    kind: CreateRequisiteProps["kind"];
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
  };
  isDefault: boolean;
}): CreateRequisiteProps {
  return {
    id: input.id,
    ownerType: input.ownerType,
    ownerId: input.ownerId,
    providerId: input.values.providerId,
    currencyId: input.values.currencyId,
    kind: input.values.kind,
    label: input.values.label,
    description: input.values.description,
    beneficiaryName: input.values.beneficiaryName,
    institutionName: input.values.institutionName,
    institutionCountry: input.values.institutionCountry,
    accountNo: input.values.accountNo,
    corrAccount: input.values.corrAccount,
    iban: input.values.iban,
    bic: input.values.bic,
    swift: input.values.swift,
    bankAddress: input.values.bankAddress,
    network: input.values.network,
    assetCode: input.values.assetCode,
    address: input.values.address,
    memoTag: input.values.memoTag,
    accountRef: input.values.accountRef,
    subaccountRef: input.values.subaccountRef,
    contact: input.values.contact,
    notes: input.values.notes,
    isDefault: input.isDefault,
  };
}

export function resolveRequisiteUpdateInput(
  current: RequisiteSnapshot,
  patch: {
    providerId?: string;
    currencyId?: string;
    kind?: RequisiteSnapshot["kind"];
    label?: string;
    description?: string | null | undefined;
    beneficiaryName?: string | null | undefined;
    institutionName?: string | null | undefined;
    institutionCountry?: string | null | undefined;
    accountNo?: string | null | undefined;
    corrAccount?: string | null | undefined;
    iban?: string | null | undefined;
    bic?: string | null | undefined;
    swift?: string | null | undefined;
    bankAddress?: string | null | undefined;
    network?: string | null | undefined;
    assetCode?: string | null | undefined;
    address?: string | null | undefined;
    memoTag?: string | null | undefined;
    accountRef?: string | null | undefined;
    subaccountRef?: string | null | undefined;
    contact?: string | null | undefined;
    notes?: string | null | undefined;
    isDefault?: boolean;
  },
): UpdateRequisiteProps {
  return {
    providerId: resolvePatchValue(current.providerId, patch.providerId),
    currencyId: resolvePatchValue(current.currencyId, patch.currencyId),
    kind: resolvePatchValue(current.kind, patch.kind),
    label: resolvePatchValue(current.label, patch.label),
    description: resolvePatchValue(current.description, patch.description),
    beneficiaryName: resolvePatchValue(
      current.beneficiaryName,
      patch.beneficiaryName,
    ),
    institutionName: resolvePatchValue(
      current.institutionName,
      patch.institutionName,
    ),
    institutionCountry: resolvePatchValue(
      current.institutionCountry,
      patch.institutionCountry,
    ),
    accountNo: resolvePatchValue(current.accountNo, patch.accountNo),
    corrAccount: resolvePatchValue(current.corrAccount, patch.corrAccount),
    iban: resolvePatchValue(current.iban, patch.iban),
    bic: resolvePatchValue(current.bic, patch.bic),
    swift: resolvePatchValue(current.swift, patch.swift),
    bankAddress: resolvePatchValue(current.bankAddress, patch.bankAddress),
    network: resolvePatchValue(current.network, patch.network),
    assetCode: resolvePatchValue(current.assetCode, patch.assetCode),
    address: resolvePatchValue(current.address, patch.address),
    memoTag: resolvePatchValue(current.memoTag, patch.memoTag),
    accountRef: resolvePatchValue(current.accountRef, patch.accountRef),
    subaccountRef: resolvePatchValue(
      current.subaccountRef,
      patch.subaccountRef,
    ),
    contact: resolvePatchValue(current.contact, patch.contact),
    notes: resolvePatchValue(current.notes, patch.notes),
    isDefault: resolvePatchValue(current.isDefault, patch.isDefault),
  };
}
