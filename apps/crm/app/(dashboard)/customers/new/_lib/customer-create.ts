import { z } from "zod";

import {
  createCustomerBankingPayload,
  getDefaultCustomerBankingValues,
  type CustomerBankingFormValues,
} from "@/lib/customer-banking";
import { localizedTextSchema } from "@/lib/validation";

const bankProviderSnapshotSchema = z.object({
  address: z.string().optional(),
  country: z.string().max(2).optional(),
  name: z.string().optional(),
  routingCode: z.string().optional(),
});

const bankRequisiteSnapshotSchema = z.object({
  accountNo: z.string().optional(),
  beneficiaryName: z.string().optional(),
  corrAccount: z
    .string()
    .optional()
    .refine(
      (value) => value === "" || value === undefined || (/^\d+$/.test(value) && value.length === 20),
      { message: "Корреспондентский счёт должен содержать 20 цифр" },
    ),
  iban: z
    .string()
    .optional()
    .refine(
      (value) =>
        value === "" ||
        value === undefined ||
        /^[A-Z0-9]{15,34}$/i.test(value),
      { message: "IBAN должен содержать от 15 до 34 символов" },
    ),
});

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function isValidRoutingCode(
  routingCode: string | undefined,
  country: string | undefined,
) {
  if (!routingCode) {
    return false;
  }

  const normalizedCountry = country?.trim().toUpperCase();
  const normalizedCode = routingCode.trim().toUpperCase();

  return normalizedCountry === "RU"
    ? /^\d{9}$/.test(normalizedCode)
    : /^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(normalizedCode);
}

function refineCustomerBanking(
  data: CustomerBankingFormValues,
  ctx: z.RefinementCtx,
) {
  const hasBankSignal = Boolean(
    data.bankProviderId ||
      hasText(data.bankProvider.name) ||
      hasText(data.bankProvider.address) ||
      hasText(data.bankProvider.routingCode) ||
      hasText(data.bankRequisite.accountNo) ||
      hasText(data.bankRequisite.corrAccount) ||
      hasText(data.bankRequisite.iban),
  );

  if (!hasBankSignal) {
    return;
  }

  if (data.bankMode === "existing") {
    if (!data.bankProviderId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bankProviderId"],
        message: "Выберите банк из справочника или переключитесь на ручной ввод",
      });
    }
  } else {
    if (!hasText(data.bankProvider.name)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bankProvider", "name"],
        message: "Название банка обязательно",
      });
    }

    if (!hasText(data.bankProvider.country)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bankProvider", "country"],
        message: "Страна банка обязательна",
      });
    }

    if (!hasText(data.bankProvider.routingCode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bankProvider", "routingCode"],
        message: "SWIFT / BIC обязателен",
      });
    } else if (
      !isValidRoutingCode(data.bankProvider.routingCode, data.bankProvider.country)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bankProvider", "routingCode"],
        message:
          data.bankProvider.country?.toUpperCase() === "RU"
            ? "БИК должен содержать 9 цифр"
            : "SWIFT / BIC должен содержать 8 или 11 символов",
      });
    }
  }

  if (!hasText(data.bankRequisite.beneficiaryName)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["bankRequisite", "beneficiaryName"],
      message: "Получатель обязателен",
    });
  }

  if (!hasText(data.bankRequisite.accountNo)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["bankRequisite", "accountNo"],
      message: "Номер счета обязателен",
    });
  }
}

const emailSchema = z.string().refine(
  (value) =>
    value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  { message: "Некорректный email" },
);

const phoneSchema = z.string().refine(
  (value) => {
    if (value === "") {
      return true;
    }

    const cleaned = value.replace(/[\s-()]/g, "");
    return /^(\+7|8)?\d{10}$/.test(cleaned);
  },
  { message: "Некорректный формат телефона (например: +7 999 123-45-67)" },
);

export const customerCreateCustomerSchema = z.object({
  description: z.string(),
  displayName: z.string().trim().min(1, "Название клиента обязательно"),
  externalRef: z.string(),
});

export const customerCreateLegalEntitySchema = z.object({
  address: z.string(),
  addressI18n: localizedTextSchema,
  directorBasis: z.string().trim().min(1, "Основание полномочий обязательно"),
  directorBasisI18n: localizedTextSchema,
  directorName: z.string().trim().min(1, "ФИО директора обязательно"),
  directorNameI18n: localizedTextSchema,
  email: emailSchema,
  inn: z
    .string()
    .trim()
    .min(1, "ИНН обязателен")
    .refine((value) => /^\d{10}$|^\d{12}$/.test(value), {
      message: "ИНН должен содержать 10 или 12 цифр",
    }),
  kpp: z.string().refine((value) => value === "" || /^\d{9}$/.test(value), {
    message: "КПП должен содержать только цифры (9 символов)",
  }),
  ogrn: z
    .string()
    .refine((value) => value === "" || /^\d{13}$|^\d{15}$/.test(value), {
      message: "ОГРН должен содержать только цифры (13 или 15 символов)",
    }),
  okpo: z
    .string()
    .refine((value) => value === "" || /^\d{8}$|^\d{10}$/.test(value), {
      message: "ОКПО должен содержать только цифры (8 или 10 символов)",
    }),
  oktmo: z
    .string()
    .refine((value) => value === "" || /^\d{8}$|^\d{11}$/.test(value), {
      message: "ОКТМО должен содержать только цифры (8 или 11 символов)",
    }),
  orgName: z.string().trim().min(1, "Название организации обязательно"),
  orgNameI18n: localizedTextSchema,
  orgType: z.string().trim().min(1, "Тип организации обязателен"),
  orgTypeI18n: localizedTextSchema,
  phone: phoneSchema,
  position: z.string().trim().min(1, "Должность обязательна"),
  positionI18n: localizedTextSchema,
});

export const customerCreateSchema = customerCreateCustomerSchema
  .merge(customerCreateLegalEntitySchema)
  .extend({
    addSubAgent: z.boolean(),
    bankMode: z.enum(["existing", "manual"]),
    bankProvider: bankProviderSnapshotSchema,
    bankProviderId: z.string().uuid().nullable(),
    bankRequisite: bankRequisiteSnapshotSchema,
    selectedSubAgentId: z.string(),
  })
  .superRefine((data, ctx) => {
    refineCustomerBanking(
      {
        bankMode: data.bankMode,
        bankProvider: data.bankProvider,
        bankProviderId: data.bankProviderId,
        bankRequisite: data.bankRequisite,
      },
      ctx,
    );
  });

export type CustomerCreateFormData = z.infer<typeof customerCreateSchema>;

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toLocalizedText(
  ruValue: string | null | undefined,
  enValue: string | null | undefined,
) {
  return {
    en: normalizeOptionalText(enValue) ?? undefined,
    ru: normalizeOptionalText(ruValue) ?? undefined,
  };
}

export function getCustomerCreateDefaultValues(): CustomerCreateFormData {
  return {
    ...getDefaultCustomerBankingValues(),
    addSubAgent: false,
    address: "",
    addressI18n: { en: "", ru: "" },
    description: "",
    directorBasis: "",
    directorBasisI18n: { en: "", ru: "" },
    directorName: "",
    directorNameI18n: { en: "", ru: "" },
    displayName: "",
    email: "",
    externalRef: "",
    inn: "",
    kpp: "",
    ogrn: "",
    okpo: "",
    oktmo: "",
    orgName: "",
    orgNameI18n: { en: "", ru: "" },
    orgType: "",
    orgTypeI18n: { en: "", ru: "" },
    phone: "",
    position: "",
    positionI18n: { en: "", ru: "" },
    selectedSubAgentId: "",
  };
}

export function buildCustomerCreatePayload(values: CustomerCreateFormData) {
  const bankingPayload = createCustomerBankingPayload(values);
  const payload: Record<string, unknown> = {
    ...bankingPayload,
    address: normalizeOptionalText(values.address),
    addressI18n: toLocalizedText(values.address, values.addressI18n.en),
    description: normalizeOptionalText(values.description),
    directorBasis: values.directorBasis.trim(),
    directorBasisI18n: toLocalizedText(
      values.directorBasis,
      values.directorBasisI18n.en,
    ),
    directorName: values.directorName.trim(),
    directorNameI18n: toLocalizedText(
      values.directorName,
      values.directorNameI18n.en,
    ),
    displayName: values.displayName.trim(),
    email: normalizeOptionalText(values.email),
    externalRef: normalizeOptionalText(values.externalRef),
    inn: values.inn.trim(),
    kpp: normalizeOptionalText(values.kpp),
    ogrn: normalizeOptionalText(values.ogrn),
    okpo: normalizeOptionalText(values.okpo),
    oktmo: normalizeOptionalText(values.oktmo),
    orgName: values.orgName.trim(),
    orgNameI18n: toLocalizedText(values.orgName, values.orgNameI18n.en),
    orgType: values.orgType.trim(),
    orgTypeI18n: toLocalizedText(values.orgType, values.orgTypeI18n.en),
    phone: normalizeOptionalText(values.phone),
    position: values.position.trim(),
    positionI18n: toLocalizedText(values.position, values.positionI18n.en),
  };

  if (values.addSubAgent && values.selectedSubAgentId.trim()) {
    payload.subAgentCounterpartyId = values.selectedSubAgentId;
  }

  return payload;
}
