import { z } from "zod";

import type { CurrencyOption } from "@bedrock/currencies/contracts";
import type { RequisiteProviderOption } from "@bedrock/parties/contracts";
import {
  bankRequisiteFormSchema,
  createBankRequisiteCreatePayload,
  createBankRequisiteUpdatePayload,
  toBankRequisiteFormValues,
} from "@bedrock/sdk-parties-ui/lib/bank-requisites";

const BankRequisiteIdentifierSchema = z.object({
  scheme: z.string(),
  value: z.string(),
  isPrimary: z.boolean(),
});

export const OrganizationBankRequisiteSchema = z.object({
  id: z.uuid(),
  ownerType: z.literal("organization"),
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

export type OrganizationBankRequisite = z.infer<
  typeof OrganizationBankRequisiteSchema
>;

export const OrganizationBankRequisitesListResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.uuid(),
      ownerType: z.literal("organization"),
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

export type BankRequisiteEditorFormData = z.infer<
  typeof bankRequisiteFormSchema
>;

export interface OrganizationRequisiteProvider {
  branches: {
    id: string;
    name: string;
  }[];
  displayName: string;
  id: string;
}

export type GroupedBankRequisites = {
  currency: CurrencyOption;
  requisites: OrganizationBankRequisite[];
};

function findIdentifierValue(
  requisite: OrganizationBankRequisite,
  scheme: string,
): string {
  return (
    requisite.identifiers.find((identifier) => identifier.scheme === scheme)
      ?.value ?? ""
  );
}

function sortRequisites(
  left: OrganizationBankRequisite,
  right: OrganizationBankRequisite,
) {
  if (left.isDefault !== right.isDefault) {
    return left.isDefault ? -1 : 1;
  }

  return left.label.localeCompare(right.label, "ru");
}

export function groupBankRequisitesByCurrency(
  requisites: OrganizationBankRequisite[],
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
  requisites: OrganizationBankRequisite[],
  requestedId: string | null,
) {
  if (requestedId && requisites.some((item) => item.id === requestedId)) {
    return requestedId;
  }

  const [first] = [...requisites].sort(sortRequisites);
  return first?.id ?? null;
}

export function bankRequisiteToFormValues(
  requisite: OrganizationBankRequisite | null,
  beneficiaryName: string,
): BankRequisiteEditorFormData {
  return toBankRequisiteFormValues(requisite, beneficiaryName);
}

export function createOrganizationBankRequisitePayload(input: {
  organizationId: string;
  values: BankRequisiteEditorFormData;
}) {
  const payload = createBankRequisiteCreatePayload({
    organizationId: input.organizationId,
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

export function createOrganizationBankRequisitePatch(
  values: BankRequisiteEditorFormData,
) {
  return createBankRequisiteUpdatePayload(values);
}

export function formatBankRequisiteIdentity(requisite: OrganizationBankRequisite) {
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
  requisite: Pick<OrganizationBankRequisite, "providerId">,
  providerOptions: RequisiteProviderOption[],
) {
  return (
    providerOptions.find((provider) => provider.id === requisite.providerId)
      ?.label ?? "Банк не выбран"
  );
}

export function getCurrencyLabel(
  currencyId: string,
  currencyOptions: CurrencyOption[],
) {
  return (
    currencyOptions.find((currency) => currency.id === currencyId)?.label ??
    "Валюта не выбрана"
  );
}
