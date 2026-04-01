import { z } from "zod";

import type {
  BankRequisiteWorkspaceItem,
  RequisiteProviderOption,
} from "@bedrock/parties/contracts";
import type { CurrencyOption } from "@bedrock/currencies/contracts";

export type CounterpartyBankRequisite = BankRequisiteWorkspaceItem;

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export const bankRequisiteEditorFormSchema = z.object({
  accountNo: z.string().trim().min(1, "Номер счёта обязателен"),
  beneficiaryName: z.string().trim().min(1, "Получатель обязателен"),
  contact: z.string().optional(),
  corrAccount: z
    .string()
    .optional()
    .refine(
      (value) => {
        if (!value || value.trim() === "") {
          return true;
        }

        return /^\d+$/.test(value.trim()) && value.trim().length === 20;
      },
      { message: "Корреспондентский счёт должен содержать 20 цифр" },
    ),
  currencyId: z.string().uuid("Выберите валюту"),
  description: z.string().optional(),
  iban: z
    .string()
    .optional()
    .refine(
      (value) => {
        if (!value || value.trim() === "") {
          return true;
        }

        return /^[A-Z0-9]{15,34}$/i.test(value.trim());
      },
      { message: "IBAN должен содержать от 15 до 34 символов" },
    ),
  isDefault: z.boolean(),
  label: z.string().trim().min(1, "Название реквизита обязательно"),
  notes: z.string().optional(),
  providerId: z.string().uuid("Выберите банк"),
});

export type BankRequisiteEditorFormData = z.infer<
  typeof bankRequisiteEditorFormSchema
>;

export type GroupedBankRequisites = {
  currency: CurrencyOption;
  requisites: CounterpartyBankRequisite[];
};

function sortRequisites(left: CounterpartyBankRequisite, right: CounterpartyBankRequisite) {
  if (left.isDefault !== right.isDefault) {
    return left.isDefault ? -1 : 1;
  }

  return left.label.localeCompare(right.label, "ru");
}

export function groupBankRequisitesByCurrency(
  requisites: CounterpartyBankRequisite[],
) {
  const groups = new Map<string, GroupedBankRequisites>();

  for (const requisite of requisites) {
    const group = groups.get(requisite.currency.id);

    if (group) {
      group.requisites.push(requisite);
      continue;
    }

    groups.set(requisite.currency.id, {
      currency: requisite.currency,
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

  const groups = groupBankRequisitesByCurrency(requisites);
  return groups[0]?.requisites[0]?.id ?? null;
}

export function createEmptyBankRequisiteValues(
  legalEntityName: string,
): BankRequisiteEditorFormData {
  return {
    accountNo: "",
    beneficiaryName: legalEntityName,
    contact: "",
    corrAccount: "",
    currencyId: "",
    description: "",
    iban: "",
    isDefault: false,
    label: "",
    notes: "",
    providerId: "",
  };
}

export function bankRequisiteToFormValues(
  requisite: CounterpartyBankRequisite | null,
  legalEntityName: string,
): BankRequisiteEditorFormData {
  if (!requisite) {
    return createEmptyBankRequisiteValues(legalEntityName);
  }

  return {
    accountNo: requisite.accountNo ?? "",
    beneficiaryName: requisite.beneficiaryName ?? legalEntityName,
    contact: requisite.contact ?? "",
    corrAccount: requisite.corrAccount ?? "",
    currencyId: requisite.currency.id,
    description: requisite.description ?? "",
    iban: requisite.iban ?? "",
    isDefault: requisite.isDefault,
    label: requisite.label,
    notes: requisite.notes ?? "",
    providerId: requisite.providerId,
  };
}

export function createCounterpartyBankRequisitePayload(input: {
  counterpartyId: string;
  values: BankRequisiteEditorFormData;
}) {
  return {
    accountNo: input.values.accountNo.trim(),
    beneficiaryName: input.values.beneficiaryName.trim(),
    contact: normalizeOptionalText(input.values.contact),
    corrAccount: normalizeOptionalText(input.values.corrAccount),
    currencyId: input.values.currencyId,
    description: normalizeOptionalText(input.values.description),
    iban: normalizeOptionalText(input.values.iban)?.toUpperCase() ?? null,
    isDefault: input.values.isDefault,
    kind: "bank" as const,
    label: input.values.label.trim(),
    notes: normalizeOptionalText(input.values.notes),
    ownerId: input.counterpartyId,
    ownerType: "counterparty" as const,
    providerId: input.values.providerId,
  };
}

export function createCounterpartyBankRequisitePatch(
  values: BankRequisiteEditorFormData,
) {
  return {
    accountNo: values.accountNo.trim(),
    beneficiaryName: values.beneficiaryName.trim(),
    contact: normalizeOptionalText(values.contact),
    corrAccount: normalizeOptionalText(values.corrAccount),
    currencyId: values.currencyId,
    description: normalizeOptionalText(values.description),
    iban: normalizeOptionalText(values.iban)?.toUpperCase() ?? null,
    isDefault: values.isDefault,
    label: values.label.trim(),
    notes: normalizeOptionalText(values.notes),
    providerId: values.providerId,
  };
}

export function formatBankRequisiteIdentity(requisite: CounterpartyBankRequisite) {
  if (requisite.accountNo) {
    const tail = requisite.accountNo.slice(-4);
    return requisite.accountNo.length > 4
      ? `Счёт ••••${tail}`
      : `Счёт ${requisite.accountNo}`;
  }

  if (requisite.iban) {
    const tail = requisite.iban.slice(-4);
    return requisite.iban.length > 4
      ? `IBAN ••••${tail}`
      : `IBAN ${requisite.iban}`;
  }

  return "Реквизиты без номера счёта";
}

export function getBankProviderLabel(
  requisite: CounterpartyBankRequisite,
  providerOptions: RequisiteProviderOption[],
) {
  if (requisite.provider?.name) {
    return requisite.provider.name;
  }

  return (
    providerOptions.find((option) => option.id === requisite.providerId)?.label ??
    "Провайдер недоступен"
  );
}

export function getCurrencyLabel(
  currencyId: string,
  currencyOptions: CurrencyOption[],
) {
  return (
    currencyOptions.find((option) => option.id === currencyId)?.label ?? "—"
  );
}
