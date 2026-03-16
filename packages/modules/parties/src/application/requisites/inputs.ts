import type { z } from "zod";

import { resolvePatchValue } from "@bedrock/shared/core";

import type {
  CreateCounterpartyRequisiteInputSchema,
  UpdateCounterpartyRequisiteInputSchema,
} from "../../contracts";
import type {
  CreateCounterpartyRequisiteProps,
  CounterpartyRequisiteSnapshot,
  UpdateCounterpartyRequisiteProps,
} from "../../domain/counterparty-requisite";

type CreateCounterpartyRequisiteValues = z.output<
  typeof CreateCounterpartyRequisiteInputSchema
>;
type UpdateCounterpartyRequisitePatch = z.output<
  typeof UpdateCounterpartyRequisiteInputSchema
>;

export function resolveCreateCounterpartyRequisiteProps(input: {
  id: string;
  values: CreateCounterpartyRequisiteValues;
  isDefault: boolean;
}): CreateCounterpartyRequisiteProps {
  return {
    id: input.id,
    counterpartyId: input.values.counterpartyId,
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

export function resolveUpdateCounterpartyRequisiteProps(
  snapshot: CounterpartyRequisiteSnapshot,
  patch: UpdateCounterpartyRequisitePatch,
): UpdateCounterpartyRequisiteProps {
  return {
    providerId: resolvePatchValue(snapshot.providerId, patch.providerId),
    currencyId: resolvePatchValue(snapshot.currencyId, patch.currencyId),
    kind: resolvePatchValue(snapshot.kind, patch.kind),
    label: resolvePatchValue(snapshot.label, patch.label),
    description: resolvePatchValue(snapshot.description, patch.description),
    beneficiaryName: resolvePatchValue(
      snapshot.beneficiaryName,
      patch.beneficiaryName,
    ),
    institutionName: resolvePatchValue(
      snapshot.institutionName,
      patch.institutionName,
    ),
    institutionCountry: resolvePatchValue(
      snapshot.institutionCountry,
      patch.institutionCountry,
    ),
    accountNo: resolvePatchValue(snapshot.accountNo, patch.accountNo),
    corrAccount: resolvePatchValue(snapshot.corrAccount, patch.corrAccount),
    iban: resolvePatchValue(snapshot.iban, patch.iban),
    bic: resolvePatchValue(snapshot.bic, patch.bic),
    swift: resolvePatchValue(snapshot.swift, patch.swift),
    bankAddress: resolvePatchValue(snapshot.bankAddress, patch.bankAddress),
    network: resolvePatchValue(snapshot.network, patch.network),
    assetCode: resolvePatchValue(snapshot.assetCode, patch.assetCode),
    address: resolvePatchValue(snapshot.address, patch.address),
    memoTag: resolvePatchValue(snapshot.memoTag, patch.memoTag),
    accountRef: resolvePatchValue(snapshot.accountRef, patch.accountRef),
    subaccountRef: resolvePatchValue(
      snapshot.subaccountRef,
      patch.subaccountRef,
    ),
    contact: resolvePatchValue(snapshot.contact, patch.contact),
    notes: resolvePatchValue(snapshot.notes, patch.notes),
    isDefault: resolvePatchValue(snapshot.isDefault, patch.isDefault),
  };
}
