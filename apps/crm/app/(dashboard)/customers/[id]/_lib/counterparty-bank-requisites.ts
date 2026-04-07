import { z } from "zod";

import type { CurrencyOption } from "@bedrock/currencies/contracts";
import type { RequisiteProviderOption } from "@bedrock/parties/contracts";
import {
  bankRequisiteFormSchema,
  createBankRequisiteCreatePayload,
  createBankRequisiteUpdatePayload,
  createEmptyBankRequisiteValues as createEmptyCanonicalBankRequisiteValues,
  toBankRequisiteFormValues,
} from "@bedrock/sdk-parties-ui/lib/bank-requisites";

export const BankRequisiteIdentifierSchema = z.object({
  scheme: z.string(),
  value: z.string(),
  isPrimary: z.boolean(),
});

export const CounterpartyBankRequisiteSchema = z.object({
  id: z.uuid(),
  ownerType: z.literal("counterparty"),
  ownerId: z.uuid(),
  organizationId: z.uuid().nullable(),
  counterpartyId: z.uuid().nullable(),
  providerId: z.uuid(),
  providerBranchId: z.uuid().nullable(),
  currencyId: z.uuid(),
  kind: z.literal("bank"),
  label: z.string(),
  beneficiaryName: z.string().nullable(),
  beneficiaryNameLocal: z.string().nullable(),
  beneficiaryAddress: z.string().nullable(),
  paymentPurposeTemplate: z.string().nullable(),
  notes: z.string().nullable(),
  isDefault: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  archivedAt: z.iso.datetime().nullable().optional(),
  identifiers: z.array(BankRequisiteIdentifierSchema),
});

export type CounterpartyBankRequisite = z.infer<
  typeof CounterpartyBankRequisiteSchema
>;

export const CounterpartyBankRequisitesListResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.uuid(),
      ownerType: z.literal("counterparty"),
      ownerId: z.uuid(),
      organizationId: z.uuid().nullable(),
      counterpartyId: z.uuid().nullable(),
      providerId: z.uuid(),
      providerBranchId: z.uuid().nullable(),
      currencyId: z.uuid(),
      kind: z.enum(["bank", "blockchain", "exchange", "custodian"]),
      label: z.string(),
      beneficiaryName: z.string().nullable(),
      beneficiaryNameLocal: z.string().nullable(),
      beneficiaryAddress: z.string().nullable(),
      paymentPurposeTemplate: z.string().nullable(),
      notes: z.string().nullable(),
      isDefault: z.boolean(),
      createdAt: z.iso.datetime(),
      updatedAt: z.iso.datetime(),
      archivedAt: z.iso.datetime().nullable().optional(),
    }),
  ),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export const RequisiteProviderDetailsSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["bank", "blockchain", "exchange", "custodian"]),
  legalName: z.string(),
  displayName: z.string(),
  description: z.string().nullable(),
  country: z.string().nullable(),
  website: z.string().nullable(),
  identifiers: z.array(
    z.object({
      scheme: z.string(),
      value: z.string(),
      isPrimary: z.boolean(),
    }),
  ),
  branches: z.array(
    z.object({
      id: z.uuid(),
      code: z.string().nullable(),
      name: z.string(),
      country: z.string().nullable(),
      postalCode: z.string().nullable(),
      city: z.string().nullable(),
      line1: z.string().nullable(),
      line2: z.string().nullable(),
      rawAddress: z.string().nullable(),
      contactEmail: z.string().nullable(),
      contactPhone: z.string().nullable(),
      isPrimary: z.boolean(),
      identifiers: z.array(
        z.object({
          scheme: z.string(),
          value: z.string(),
          isPrimary: z.boolean(),
        }),
      ),
    }),
  ),
});

export type RequisiteProviderDetails = z.infer<
  typeof RequisiteProviderDetailsSchema
>;

export const bankRequisiteEditorFormSchema = bankRequisiteFormSchema;

export type BankRequisiteEditorFormData = z.infer<
  typeof bankRequisiteEditorFormSchema
>;

export type GroupedBankRequisites = {
  currency: CurrencyOption;
  requisites: CounterpartyBankRequisite[];
};

function findIdentifierValue(
  requisite: CounterpartyBankRequisite,
  scheme: string,
): string {
  return (
    requisite.identifiers.find((identifier) => identifier.scheme === scheme)
      ?.value ?? ""
  );
}

function sortRequisites(
  left: CounterpartyBankRequisite,
  right: CounterpartyBankRequisite,
) {
  if (left.isDefault !== right.isDefault) {
    return left.isDefault ? -1 : 1;
  }

  return left.label.localeCompare(right.label, "ru");
}

export function groupBankRequisitesByCurrency(
  requisites: CounterpartyBankRequisite[],
  currencyOptions: CurrencyOption[],
) {
  const currencyById = new Map(currencyOptions.map((item) => [item.id, item]));
  const groups = new Map<string, GroupedBankRequisites>();

  for (const requisite of requisites) {
    const currency = currencyById.get(requisite.currencyId);
    if (!currency) {
      continue;
    }

    const group = groups.get(currency.id);

    if (group) {
      group.requisites.push(requisite);
      continue;
    }

    groups.set(currency.id, {
      currency,
      requisites: [requisite],
    });
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      requisites: [...group.requisites].sort(sortRequisites),
    }))
    .sort((left, right) =>
      left.currency.code.localeCompare(right.currency.code, "ru"),
    );
}

export function resolveInitialBankRequisiteId(
  requisites: CounterpartyBankRequisite[],
  requestedId: string | null,
) {
  if (requestedId && requisites.some((item) => item.id === requestedId)) {
    return requestedId;
  }

  const [first] = [...requisites].sort(sortRequisites);
  return first?.id ?? null;
}

export function createEmptyBankRequisiteValues(
  legalEntityName: string,
): BankRequisiteEditorFormData {
  return createEmptyCanonicalBankRequisiteValues(legalEntityName);
}

export function bankRequisiteToFormValues(
  requisite: CounterpartyBankRequisite | null,
  legalEntityName: string,
): BankRequisiteEditorFormData {
  return toBankRequisiteFormValues(requisite, legalEntityName);
}

export function createCounterpartyBankRequisitePayload(input: {
  counterpartyId: string;
  values: BankRequisiteEditorFormData;
}) {
  const payload = createBankRequisiteCreatePayload({
    counterpartyId: input.counterpartyId,
    values: input.values,
  });

  return {
    providerId: payload.providerId,
    providerBranchId: payload.providerBranchId,
    currencyId: payload.currencyId,
    kind: payload.kind,
    label: payload.label,
    beneficiaryName: payload.beneficiaryName,
    beneficiaryNameLocal: payload.beneficiaryNameLocal,
    beneficiaryAddress: payload.beneficiaryAddress,
    paymentPurposeTemplate: payload.paymentPurposeTemplate,
    notes: payload.notes,
    identifiers: payload.identifiers,
    isDefault: payload.isDefault,
  };
}

export function createCounterpartyBankRequisitePatch(
  values: BankRequisiteEditorFormData,
) {
  return createBankRequisiteUpdatePayload(values);
}

export function formatBankRequisiteIdentity(requisite: CounterpartyBankRequisite) {
  const accountNo = findIdentifierValue(requisite, "local_account_number");
  if (accountNo) {
    const tail = accountNo.slice(-4);
    return accountNo.length > 4 ? `Счёт ••••${tail}` : `Счёт ${accountNo}`;
  }

  const iban = findIdentifierValue(requisite, "iban");
  if (iban) {
    const tail = iban.slice(-4);
    return iban.length > 4 ? `IBAN ••••${tail}` : `IBAN ${iban}`;
  }

  return "Реквизиты без номера счёта";
}

export function getBankProviderLabel(
  requisite: Pick<CounterpartyBankRequisite, "providerId">,
  providerOptions: RequisiteProviderOption[],
) {
  return (
    providerOptions.find((option) => option.id === requisite.providerId)?.label ??
    "Провайдер недоступен"
  );
}

export function getCurrencyLabel(
  currencyId: string,
  currencyOptions: CurrencyOption[],
) {
  return currencyOptions.find((option) => option.id === currencyId)?.label ?? "—";
}
