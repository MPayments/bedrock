import { resolvePatchValue } from "@bedrock/shared/core";
import { type RequisiteKind } from "@bedrock/shared/requisites";

import type {
  OrganizationRequisiteSnapshot,
  UpdateOrganizationRequisiteProps,
} from "../../domain/organization-requisite";

export function resolveOrganizationRequisiteUpdateInput(
  current: OrganizationRequisiteSnapshot,
  patch: {
    providerId?: string;
    currencyId?: string;
    kind?: RequisiteKind;
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
): UpdateOrganizationRequisiteProps {
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
