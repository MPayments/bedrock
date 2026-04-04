import { z } from "zod";

// --- Localized text ---

export const localizedTextSchema = z.object({
  ru: z.string().optional(),
  en: z.string().optional(),
});

export type LocalizedText = z.infer<typeof localizedTextSchema>;

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
      (val) => {
        if (!val || val === "") return true;
        return /^\d+$/.test(val) && val.length === 20;
      },
      { message: "Корреспондентский счёт должен содержать 20 цифр" }
    ),
  iban: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val === "") return true;
        return /^[A-Z0-9]{15,34}$/i.test(val);
      },
      { message: "IBAN должен содержать от 15 до 34 символов" }
    ),
});

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function hasBankSignal(input: {
  bankProvider?: z.infer<typeof bankProviderSnapshotSchema>;
  bankProviderId?: string | null;
  bankRequisite?: z.infer<typeof bankRequisiteSnapshotSchema>;
}) {
  return Boolean(
    input.bankProviderId ||
      hasText(input.bankProvider?.name) ||
      hasText(input.bankProvider?.address) ||
      hasText(input.bankProvider?.routingCode) ||
      hasText(input.bankRequisite?.accountNo) ||
      hasText(input.bankRequisite?.corrAccount) ||
      hasText(input.bankRequisite?.iban)
  );
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
  data: z.infer<typeof customerBankingFieldsSchema>,
  ctx: z.RefinementCtx,
) {
  if (!hasBankSignal(data)) {
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
      !isValidRoutingCode(
        data.bankProvider.routingCode,
        data.bankProvider.country,
      )
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

export const customerBankingFieldsSchema = z.object({
  bankMode: z.enum(["existing", "manual"]),
  bankProviderId: z.preprocess(
    (value) => (value === "" ? null : value),
    z.string().uuid().nullable()
  ),
  bankProvider: bankProviderSnapshotSchema,
  bankRequisite: bankRequisiteSnapshotSchema,
});

export type CustomerBankingFormData = z.infer<
  typeof customerBankingFieldsSchema
>;

// --- Client ---

const phoneSchema = z
  .string()
  .optional()
  .refine(
    (val) => {
      if (!val || val === "") return true;
      const cleaned = val.replace(/[\s-()]/g, "");
      return /^(\+7|8)?\d{10}$/.test(cleaned);
    },
    { message: "Некорректный формат телефона (например: +7 999 123-45-67)" }
  );

const clientFieldsSchema = z.object({
  orgName: z.string().min(1, "Название организации обязательно"),
  orgNameI18n: localizedTextSchema.optional(),
  orgType: z.string().min(1, "Тип организации обязателен"),
  orgTypeI18n: localizedTextSchema.optional(),
  directorName: z.string().min(1, "ФИО директора обязательно"),
  directorNameI18n: localizedTextSchema.optional(),
  position: z.string().min(1, "Должность обязательна"),
  positionI18n: localizedTextSchema.optional(),
  directorBasis: z.string().min(1, "Основание полномочий обязательно"),
  directorBasisI18n: localizedTextSchema.optional(),
  address: z.string().optional(),
  addressI18n: localizedTextSchema.optional(),
  email: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val === "") return true;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
      },
      { message: "Некорректный email" }
    ),
  phone: phoneSchema,
  inn: z
    .string()
    .min(1, "ИНН обязателен")
    .refine(
      (val) => {
        if (!val || val === "") return false;
        if (!/^\d+$/.test(val)) return false;
        return val.length === 10 || val.length === 12;
      },
      { message: "ИНН должен содержать 10 или 12 цифр" }
    ),
  kpp: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val === "") return true;
        return /^\d+$/.test(val) && val.length === 9;
      },
      { message: "КПП должен содержать только цифры (9 символов)" }
    ),
  ogrn: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val === "") return true;
        return /^\d+$/.test(val) && (val.length === 13 || val.length === 15);
      },
      { message: "ОГРН должен содержать только цифры (13 или 15 символов)" }
    ),
  oktmo: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val === "") return true;
        return /^\d+$/.test(val) && (val.length === 8 || val.length === 11);
      },
      { message: "ОКТМО должен содержать только цифры (8 или 11 символов)" }
    ),
  okpo: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val === "") return true;
        return /^\d+$/.test(val) && (val.length === 8 || val.length === 10);
      },
      { message: "ОКПО должен содержать только цифры (8 или 10 символов)" }
    ),
  ...customerBankingFieldsSchema.shape,
});

export const clientSchema = clientFieldsSchema.superRefine(refineCustomerBanking);

const createClientFieldsSchema = clientFieldsSchema.extend({
  subAgentCounterpartyId: z.string().uuid().optional(),
  contractNumber: z.string().optional(),
  contractDate: z.string().optional(),
  agentFee: z.string().optional(),
  fixedFee: z.string().optional(),
  organizationId: z.string().uuid().optional(),
  organizationRequisiteId: z.string().uuid().optional(),
});

export const createClientSchema =
  createClientFieldsSchema.superRefine(refineCustomerBanking);

export const updateClientSchema =
  createClientFieldsSchema.partial().superRefine((data, ctx) => {
    if (
      data.bankMode ||
      data.bankProviderId !== undefined ||
      data.bankProvider !== undefined ||
      data.bankRequisite !== undefined
    ) {
      refineCustomerBanking(
        {
          bankMode: data.bankMode ?? "existing",
          bankProvider: {
            address: data.bankProvider?.address,
            country: data.bankProvider?.country,
            name: data.bankProvider?.name,
            routingCode: data.bankProvider?.routingCode,
          },
          bankProviderId: data.bankProviderId ?? null,
          bankRequisite: {
            accountNo: data.bankRequisite?.accountNo,
            beneficiaryName: data.bankRequisite?.beneficiaryName,
            corrAccount: data.bankRequisite?.corrAccount,
            iban: data.bankRequisite?.iban,
          },
        },
        ctx
      );
    }
  });

export type CreateClientInput = z.input<typeof createClientSchema>;
export type UpdateClientInput = z.input<typeof updateClientSchema>;

// --- Organization ---

export const organizationSchema = z.object({
  name: z.string().min(1, "Название организации обязательно"),
  nameI18n: localizedTextSchema.optional(),
  orgType: z.string().min(1, "Тип организации обязателен"),
  orgTypeI18n: localizedTextSchema.optional(),
  country: z.string().min(1, "Страна обязательна"),
  countryI18n: localizedTextSchema.optional(),
  city: z.string().min(1, "Город обязателен"),
  cityI18n: localizedTextSchema.optional(),
  address: z.string().min(1, "Адрес обязателен"),
  addressI18n: localizedTextSchema.optional(),
  inn: z.string().optional(),
  taxId: z.string().optional(),
  kpp: z.string().optional(),
  ogrn: z.string().optional(),
  oktmo: z.string().optional(),
  okpo: z.string().optional(),
  directorName: z.string().min(1, "ФИО директора обязательно"),
  directorNameI18n: localizedTextSchema.optional(),
  directorPosition: z.string().min(1, "Должность директора обязательна"),
  directorPositionI18n: localizedTextSchema.optional(),
  directorBasis: z.string().min(1, "Основание полномочий обязательно"),
  directorBasisI18n: localizedTextSchema.optional(),
});

export const createOrganizationSchema = organizationSchema;

export const updateOrganizationSchema = organizationSchema.partial();

export const editOrganizationSchema = organizationSchema;

export type OrganizationFormData = z.infer<typeof organizationSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type EditOrganizationInput = z.infer<typeof editOrganizationSchema>;

// --- Customer ---

const customerOnboardFieldsSchema = z.object({
  name: z.string().min(2, "Имя должно содержать минимум 2 символа").max(255),
  orgName: z.string().min(1, "Название организации обязательно"),
  orgNameI18n: localizedTextSchema.optional(),
  orgType: z.string().optional(),
  orgTypeI18n: localizedTextSchema.optional(),
  inn: z
    .string()
    .min(1, "ИНН обязателен")
    .refine(
      (val) => {
        if (!val) return false;
        if (!/^\d+$/.test(val)) return false;
        return val.length === 10 || val.length === 12;
      },
      { message: "ИНН должен содержать 10 или 12 цифр" }
    ),
  directorName: z.string().min(1, "ФИО директора обязательно"),
  directorNameI18n: localizedTextSchema.optional(),
  position: z.string().optional(),
  positionI18n: localizedTextSchema.optional(),
  directorBasis: z.string().optional(),
  directorBasisI18n: localizedTextSchema.optional(),
  address: z.string().optional(),
  addressI18n: localizedTextSchema.optional(),
  email: z.string().email("Некорректный email").optional().or(z.literal("")),
  phone: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val === "") return true;
        const cleaned = val.replace(/[\s-()]/g, "");
        return /^(\+7|8)?\d{10}$/.test(cleaned);
      },
      { message: "Некорректный формат телефона" }
    ),
  kpp: z.string().optional(),
  ogrn: z.string().optional(),
  oktmo: z.string().optional(),
  okpo: z.string().optional(),
  ...customerBankingFieldsSchema.shape,
});

export const customerOnboardSchema =
  customerOnboardFieldsSchema.superRefine(refineCustomerBanking);

export type ClientFormData = z.infer<typeof clientSchema>;
export type CustomerOnboardInput = z.infer<typeof customerOnboardSchema>;

// --- Contract ---

function parseNonNegativeDecimal(value: string): {
  fraction: string;
  integer: string;
} | null {
  const normalized = value.trim().replace(",", ".");
  const match = normalized.match(/^(\d+)(?:\.(\d+))?$/u);

  if (!match) {
    return null;
  }

  return {
    fraction: match[2] ?? "",
    integer: match[1] ?? "0",
  };
}

const percentFeeSchema = z
  .string()
  .optional()
  .refine(
    (val) => {
      if (!val || val === "") return true;
      const parsed = parseNonNegativeDecimal(val);
      if (!parsed) {
        return false;
      }

      const integer = parsed.integer.replace(/^0+(?=\d)/u, "") || "0";
      if (integer.length < 3) {
        return true;
      }

      return integer === "100" && /^0*$/u.test(parsed.fraction);
    },
    { message: "Комиссия должна быть числом от 0 до 100" }
  );

const fixedFeeSchema = z
  .string()
  .optional()
  .refine(
    (val) => {
      if (!val || val === "") return true;
      return parseNonNegativeDecimal(val) !== null;
    },
    { message: "Комиссия должна быть положительным числом" }
  );

export const contractSchema = z.object({
  organizationId: z.string().uuid("Организация обязательна"),
  organizationRequisiteId: z.string().uuid("Реквизит обязателен"),
  agentFee: percentFeeSchema,
  fixedFee: fixedFeeSchema,
});

export type ContractFormData = z.infer<typeof contractSchema>;

// --- Sub-agent ---

export const subAgentSchema = z.object({
  name: z
    .string()
    .min(1, "Имя субагента обязательно")
    .max(255),
  commission: z
    .number({ error: "Комиссия должна быть числом" })
    .min(0, "Комиссия не может быть отрицательной")
    .max(100, "Комиссия не может превышать 100%"),
});

export type SubAgentFormData = z.infer<typeof subAgentSchema>;
