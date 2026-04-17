import { z } from "zod";

import type {
  CreateCounterpartyInput,
  CreateCustomerInput,
  CreateRequisiteInput,
  CreateRequisiteProviderInput,
  PartyProfileBundleInput,
} from "@bedrock/parties/contracts";
import {
  getDefaultCustomerBankingValues,
  normalizeRoutingCode,
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
  name: z.string().trim().min(1, "Название клиента обязательно"),
  externalRef: z.string(),
});

export const customerCreateSchema = customerCreateCustomerSchema
  .extend({
    counterpartyKind: z
      .enum(["legal_entity", "individual"])
      .default("legal_entity"),
    address: z.string(),
    addressI18n: localizedTextSchema,
    directorBasis: z.string(),
    directorBasisI18n: localizedTextSchema,
    directorName: z.string(),
    directorNameI18n: localizedTextSchema,
    email: emailSchema,
    inn: z.string().refine(
      (value) => value === "" || /^\d{10}$|^\d{12}$/.test(value),
      {
        message: "ИНН должен содержать 10 или 12 цифр",
      },
    ),
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
    orgName: z.string(),
    orgNameI18n: localizedTextSchema,
    orgType: z.string(),
    orgTypeI18n: localizedTextSchema,
    personFullName: z.string(),
    personFullNameI18n: localizedTextSchema,
    phone: phoneSchema,
    position: z.string(),
    positionI18n: localizedTextSchema,
  })
  .extend({
    addSubAgent: z.boolean(),
    bankMode: z.enum(["existing", "manual"]),
    bankProvider: bankProviderSnapshotSchema,
    bankProviderId: z.string().uuid().nullable(),
    bankRequisite: bankRequisiteSnapshotSchema,
    selectedSubAgentId: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.counterpartyKind === "legal_entity") {
      if (!data.orgName.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["orgName"],
          message: "Название организации обязательно",
        });
      }
      if (!data.orgType.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["orgType"],
          message: "Тип организации обязателен",
        });
      }
      if (!data.inn.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["inn"],
          message: "ИНН обязателен",
        });
      }
      if (!data.directorName.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["directorName"],
          message: "ФИО директора обязательно",
        });
      }
      if (!data.position.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["position"],
          message: "Должность обязательна",
        });
      }
      if (!data.directorBasis.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["directorBasis"],
          message: "Основание полномочий обязательно",
        });
      }
    } else if (!data.personFullName.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["personFullName"],
        message: "ФИО обязательно",
      });
    }

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
    en: normalizeOptionalText(enValue),
    ru: normalizeOptionalText(ruValue),
  };
}

function resolveCounterpartyDisplayName(values: CustomerCreateFormData) {
  return values.counterpartyKind === "legal_entity"
    ? values.orgName.trim()
    : values.personFullName.trim();
}

function buildPartyProfileBundle(
  values: CustomerCreateFormData,
): PartyProfileBundleInput {
  if (values.counterpartyKind === "individual") {
    const contacts = [
      values.email.trim()
        ? {
            type: "email" as const,
            value: values.email.trim(),
            isPrimary: true,
          }
        : null,
      values.phone.trim()
        ? {
            type: "phone" as const,
            value: values.phone.trim(),
            isPrimary: true,
          }
        : null,
    ].filter((item) => item !== null);

    return {
      profile: {
        fullName: values.personFullName.trim(),
        shortName: values.personFullName.trim(),
        fullNameI18n: toLocalizedText(
          values.personFullNameI18n.ru,
          values.personFullNameI18n.en,
        ),
        shortNameI18n: toLocalizedText(
          values.personFullNameI18n.ru,
          values.personFullNameI18n.en,
        ),
        legalFormCode: null,
        legalFormLabel: null,
        legalFormLabelI18n: null,
        countryCode: null,
        businessActivityCode: null,
        businessActivityText: null,
        businessActivityTextI18n: null,
      },
      identifiers: values.inn.trim()
        ? [{ scheme: "inn" as const, value: values.inn.trim() }]
        : [],
      address: values.address.trim()
        ? {
            countryCode: null,
            postalCode: null,
            city: null,
            cityI18n: null,
            streetAddress: null,
            streetAddressI18n: null,
            addressDetails: null,
            addressDetailsI18n: null,
            fullAddress: values.address.trim(),
            fullAddressI18n: toLocalizedText(
              values.addressI18n.ru,
              values.addressI18n.en,
            ),
          }
        : null,
      contacts,
      representatives: [],
      licenses: [],
    };
  }

  const identifiers = [
    { scheme: "inn" as const, value: values.inn.trim() },
    values.kpp.trim() ? { scheme: "kpp" as const, value: values.kpp.trim() } : null,
    values.ogrn.trim()
      ? { scheme: "ogrn" as const, value: values.ogrn.trim() }
      : null,
    values.okpo.trim()
      ? { scheme: "okpo" as const, value: values.okpo.trim() }
      : null,
    values.oktmo.trim()
      ? { scheme: "oktmo" as const, value: values.oktmo.trim() }
      : null,
  ].filter((item) => item !== null);

  const contacts = [
    values.email.trim()
      ? {
          type: "email" as const,
          value: values.email.trim(),
          isPrimary: true,
        }
      : null,
    values.phone.trim()
      ? {
          type: "phone" as const,
          value: values.phone.trim(),
          isPrimary: true,
        }
      : null,
  ].filter((item) => item !== null);

  return {
    profile: {
      fullName: values.orgName.trim(),
      shortName: values.orgName.trim(),
      fullNameI18n: toLocalizedText(
        values.orgNameI18n.ru,
        values.orgNameI18n.en,
      ),
      shortNameI18n: toLocalizedText(
        values.orgNameI18n.ru,
        values.orgNameI18n.en,
      ),
      legalFormCode: null,
      legalFormLabel: values.orgType.trim(),
      legalFormLabelI18n: toLocalizedText(
        values.orgTypeI18n.ru,
        values.orgTypeI18n.en,
      ),
      countryCode: null,
      businessActivityCode: null,
      businessActivityText: null,
      businessActivityTextI18n: null,
    },
    identifiers,
    address: values.address.trim()
      ? {
        countryCode: null,
        postalCode: null,
        city: null,
        cityI18n: null,
        streetAddress: null,
        streetAddressI18n: null,
        addressDetails: null,
        addressDetailsI18n: null,
        fullAddress: values.address.trim(),
        fullAddressI18n: toLocalizedText(
          values.addressI18n.ru,
          values.addressI18n.en,
        ),
      }
    : null,
    contacts,
    representatives: [
      {
        role: "director",
        fullName: values.directorName.trim(),
        fullNameI18n: toLocalizedText(
          values.directorNameI18n.ru,
          values.directorNameI18n.en,
        ),
        title: values.position.trim(),
        titleI18n: toLocalizedText(
          values.positionI18n.ru,
          values.positionI18n.en,
        ),
        basisDocument: values.directorBasis.trim(),
        basisDocumentI18n: toLocalizedText(
          values.directorBasisI18n.ru,
          values.directorBasisI18n.en,
        ),
        isPrimary: true,
      },
    ],
    licenses: [],
  };
}

export const customerCreateCounterpartySchema = z.object({
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

export function getCustomerCreateDefaultValues(): CustomerCreateFormData {
  return {
    ...getDefaultCustomerBankingValues(),
    addSubAgent: false,
    address: "",
    addressI18n: { en: "", ru: "" },
    counterpartyKind: "legal_entity",
    description: "",
    directorBasis: "",
    directorBasisI18n: { en: "", ru: "" },
    directorName: "",
    directorNameI18n: { en: "", ru: "" },
    name: "",
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
    personFullName: "",
    personFullNameI18n: { en: "", ru: "" },
    phone: "",
    position: "",
    positionI18n: { en: "", ru: "" },
    selectedSubAgentId: "",
  };
}

function hasBankingSignal(values: CustomerCreateFormData) {
  return Boolean(
    values.bankProviderId ||
      hasText(values.bankProvider.name) ||
      hasText(values.bankProvider.address) ||
      hasText(values.bankProvider.routingCode) ||
      hasText(values.bankRequisite.accountNo) ||
      hasText(values.bankRequisite.iban),
  );
}

export function buildCustomerCreatePayload(
  values: CustomerCreateFormData,
): CreateCustomerInput {
  return {
    description: normalizeOptionalText(values.description),
    name: values.name.trim(),
    externalRef: normalizeOptionalText(values.externalRef),
  };
}

export function buildCustomerCounterpartyCreatePayload(input: {
  customerId: string;
  values: CustomerCreateFormData;
}): CreateCounterpartyInput {
  const { customerId, values } = input;
  const counterpartyName = resolveCounterpartyDisplayName(values);

  return {
    kind: values.counterpartyKind,
    shortName: counterpartyName,
    fullName: counterpartyName,
    relationshipKind: "customer_owned",
    country: null,
    externalRef: normalizeOptionalText(values.inn),
    description: null,
    customerId,
    groupIds: [],
    partyProfile: buildPartyProfileBundle(values),
  };
}

export function buildCounterpartyAssignmentPayload(values: CustomerCreateFormData) {
  return {
    subAgentCounterpartyId:
      values.addSubAgent && values.selectedSubAgentId.trim()
        ? values.selectedSubAgentId.trim()
        : null,
  };
}

export function buildManualBankProviderCreatePayload(
  values: CustomerCreateFormData,
): CreateRequisiteProviderInput | null {
  if (!hasBankingSignal(values) || values.bankMode !== "manual") {
    return null;
  }

  const country = normalizeOptionalText(values.bankProvider.country)?.toUpperCase() ?? null;
  const routing = normalizeRoutingCode({
    country,
    routingCode: values.bankProvider.routingCode,
  });
  const providerAddress = normalizeOptionalText(values.bankProvider.address);
  const providerName =
    normalizeOptionalText(values.bankProvider.name) ??
    resolveCounterpartyDisplayName(values);

  if (!providerName || !country || !routing.routingCode) {
    return null;
  }

  return {
    kind: "bank",
    legalName: providerName,
    displayName: providerName,
    description: null,
    country,
    website: null,
    identifiers: [
      ...(routing.bic
        ? [{ scheme: "bic", value: routing.bic, isPrimary: true }]
        : []),
      ...(routing.swift
        ? [{ scheme: "swift", value: routing.swift, isPrimary: true }]
        : []),
    ],
    branches: providerAddress
      ? [
          {
            code: null,
            name: providerName,
            country,
            postalCode: null,
            city: null,
            line1: null,
            line2: null,
            rawAddress: providerAddress,
            contactEmail: null,
            contactPhone: null,
            isPrimary: true,
            identifiers: [],
          },
        ]
      : [],
  };
}

export function buildCounterpartyBankRequisiteCreatePayload(input: {
  counterpartyId: string;
  currencyId: string;
  providerBranchId: string | null;
  providerId: string;
  values: CustomerCreateFormData;
}): CreateRequisiteInput | null {
  const { counterpartyId, currencyId, providerBranchId, providerId, values } =
    input;
  if (!hasBankingSignal(values)) {
    return null;
  }

  const accountNo = normalizeOptionalText(values.bankRequisite.accountNo);
  const beneficiaryName =
    normalizeOptionalText(values.bankRequisite.beneficiaryName) ??
    resolveCounterpartyDisplayName(values);

  if (!accountNo || !beneficiaryName) {
    return null;
  }

  return {
    ownerType: "counterparty",
    ownerId: counterpartyId,
    providerId,
    providerBranchId,
    currencyId,
    kind: "bank",
    label:
      normalizeOptionalText(values.bankProvider.name) ??
      resolveCounterpartyDisplayName(values) ??
      "Bank details",
    beneficiaryName,
    beneficiaryNameLocal: null,
    beneficiaryAddress: null,
    paymentPurposeTemplate: null,
    notes: null,
    identifiers: [
      {
        scheme: "local_account_number",
        value: accountNo,
        isPrimary: true,
      },
      ...(normalizeOptionalText(values.bankRequisite.iban)
        ? [
            {
              scheme: "iban",
              value: normalizeOptionalText(values.bankRequisite.iban)!,
              isPrimary: true,
            },
          ]
        : []),
    ],
    isDefault: true,
  };
}

export function resolveDefaultRequisiteCurrencyCode(
  values: CustomerCreateFormData,
) {
  const country =
    normalizeOptionalText(values.bankProvider.country)?.toUpperCase() ?? null;
  return country === "RU" ? "RUB" : "USD";
}
