import { z } from "zod";

function trimToNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export const bankRequisiteFormSchema = z.object({
  beneficiaryName: z.string().trim().min(1, "Получатель обязателен"),
  beneficiaryNameLocal: z.string().optional(),
  beneficiaryAddress: z.string().optional(),
  accountNo: z.string().trim().min(1, "Номер счёта обязателен"),
  iban: z.string().optional(),
  currencyId: z.string().uuid("Выберите валюту"),
  label: z.string().trim().min(1, "Название реквизита обязательно"),
  providerId: z.string().uuid("Выберите банк"),
  providerBranchId: z.string().optional(),
  notes: z.string().optional(),
  paymentPurposeTemplate: z.string().optional(),
  isDefault: z.boolean(),
});

export type BankRequisiteFormValues = z.infer<typeof bankRequisiteFormSchema>;

export type BankRequisiteSource = {
  beneficiaryName: string | null;
  beneficiaryNameLocal: string | null;
  beneficiaryAddress: string | null;
  currencyId: string;
  label: string;
  providerId: string;
  providerBranchId: string | null;
  notes: string | null;
  paymentPurposeTemplate: string | null;
  isDefault: boolean;
  identifiers: Array<{
    scheme: string;
    value: string;
    isPrimary: boolean;
  }>;
};

export function createEmptyBankRequisiteValues(
  beneficiaryName: string,
): BankRequisiteFormValues {
  return {
    beneficiaryName,
    beneficiaryNameLocal: "",
    beneficiaryAddress: "",
    accountNo: "",
    iban: "",
    currencyId: "",
    label: "",
    providerId: "",
    providerBranchId: "",
    notes: "",
    paymentPurposeTemplate: "",
    isDefault: false,
  };
}

function findIdentifier(
  identifiers: BankRequisiteSource["identifiers"],
  scheme: string,
): string {
  return (
    identifiers.find((identifier) => identifier.scheme === scheme)?.value ?? ""
  );
}

export function toBankRequisiteFormValues(
  requisite: BankRequisiteSource | null,
  fallbackBeneficiaryName: string,
): BankRequisiteFormValues {
  if (!requisite) {
    return createEmptyBankRequisiteValues(fallbackBeneficiaryName);
  }

  return {
    beneficiaryName: requisite.beneficiaryName ?? fallbackBeneficiaryName,
    beneficiaryNameLocal: requisite.beneficiaryNameLocal ?? "",
    beneficiaryAddress: requisite.beneficiaryAddress ?? "",
    accountNo: findIdentifier(requisite.identifiers, "local_account_number"),
    iban: findIdentifier(requisite.identifiers, "iban"),
    currencyId: requisite.currencyId,
    label: requisite.label,
    providerId: requisite.providerId,
    providerBranchId: requisite.providerBranchId ?? "",
    notes: requisite.notes ?? "",
    paymentPurposeTemplate: requisite.paymentPurposeTemplate ?? "",
    isDefault: requisite.isDefault,
  };
}

export function buildBankRequisiteIdentifiers(
  values: Pick<BankRequisiteFormValues, "accountNo" | "iban">,
) {
  const iban = values.iban?.trim() ?? "";

  return [
    values.accountNo.trim()
      ? {
          scheme: "local_account_number",
          value: values.accountNo.trim(),
          isPrimary: !iban,
        }
      : null,
    iban
      ? {
          scheme: "iban",
          value: iban.toUpperCase(),
          isPrimary: !values.accountNo.trim(),
        }
      : null,
  ].filter(
    (
      item,
    ): item is { scheme: string; value: string; isPrimary: boolean } =>
      item !== null,
  );
}

export function createBankRequisiteCreatePayload(input: {
  counterpartyId?: string;
  organizationId?: string;
  values: BankRequisiteFormValues;
}) {
  const ownerType = input.organizationId ? "organization" : "counterparty";
  const ownerId = input.organizationId ?? input.counterpartyId;

  if (!ownerId) {
    throw new Error("owner id is required to create a bank requisite");
  }

  return {
    ownerType,
    ownerId,
    providerId: input.values.providerId,
    providerBranchId: trimToNull(input.values.providerBranchId),
    currencyId: input.values.currencyId,
    kind: "bank" as const,
    label: input.values.label.trim(),
    beneficiaryName: trimToNull(input.values.beneficiaryName),
    beneficiaryNameLocal: trimToNull(input.values.beneficiaryNameLocal),
    beneficiaryAddress: trimToNull(input.values.beneficiaryAddress),
    paymentPurposeTemplate: trimToNull(input.values.paymentPurposeTemplate),
    notes: trimToNull(input.values.notes),
    identifiers: buildBankRequisiteIdentifiers(input.values),
    isDefault: input.values.isDefault,
  };
}

export function createBankRequisiteUpdatePayload(
  values: BankRequisiteFormValues,
) {
  return {
    providerId: values.providerId,
    providerBranchId: trimToNull(values.providerBranchId),
    currencyId: values.currencyId,
    label: values.label.trim(),
    beneficiaryName: trimToNull(values.beneficiaryName),
    beneficiaryNameLocal: trimToNull(values.beneficiaryNameLocal),
    beneficiaryAddress: trimToNull(values.beneficiaryAddress),
    paymentPurposeTemplate: trimToNull(values.paymentPurposeTemplate),
    notes: trimToNull(values.notes),
    identifiers: buildBankRequisiteIdentifiers(values),
    isDefault: values.isDefault,
  };
}
