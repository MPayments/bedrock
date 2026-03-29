import { z } from "zod";

// --- Localized text ---

export const localizedTextSchema = z.object({
  ru: z.string().optional(),
  en: z.string().optional(),
});

export type LocalizedText = z.infer<typeof localizedTextSchema>;

// --- Client ---

const phoneSchema = z
  .string()
  .optional()
  .refine(
    (val) => {
      if (!val || val === "") return true;
      const cleaned = val.replace(/[\s\-\(\)]/g, "");
      return /^(\+7|8)?\d{10}$/.test(cleaned);
    },
    { message: "Некорректный формат телефона (например: +7 999 123-45-67)" }
  );

export const clientSchema = z.object({
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
  bankName: z.string().optional(),
  bankNameI18n: localizedTextSchema.optional(),
  bankAddress: z.string().optional(),
  bankAddressI18n: localizedTextSchema.optional(),
  account: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val === "") return true;
        return /^\d+$/.test(val) && val.length === 20;
      },
      { message: "Расчётный счёт должен содержать 20 цифр" }
    ),
  bic: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val === "") return true;
        return /^\d+$/.test(val) && val.length === 9;
      },
      { message: "БИК должен содержать 9 цифр" }
    ),
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
  bankCountry: z.string().max(2).optional(),
});

export const createClientSchema = clientSchema.extend({
  subAgentId: z.number().optional(),
  contractNumber: z.string().optional(),
  contractDate: z.string().optional(),
  agentFee: z.string().optional(),
  fixedFee: z.string().optional(),
  organizationId: z.string().uuid().optional(),
  agentOrganizationBankDetailsId: z.number().optional(),
});

export const updateClientSchema = createClientSchema.partial();

export type ClientFormData = z.infer<typeof clientSchema>;
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

// --- Organization ---

export const organizationBankSchema = z.object({
  name: z.string().min(1, "Название счёта обязательно"),
  nameI18n: localizedTextSchema.optional(),
  bankName: z.string().min(1, "Название банка обязательно"),
  bankNameI18n: localizedTextSchema.optional(),
  bankAddress: z.string().optional(),
  bankAddressI18n: localizedTextSchema.optional(),
  account: z.string().min(1, "Номер счёта обязателен").max(34),
  bic: z.string().optional(),
  corrAccount: z.string().optional(),
  swiftCode: z.string().optional(),
  currencyCode: z.string().optional(),
});

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

const validateBankCodes = (
  banks: Array<{ bic?: string; swiftCode?: string }>,
  ctx: z.RefinementCtx,
) => {
  banks.forEach((bank, index) => {
    const hasBic = !!bank.bic?.trim();
    const hasSwift = !!bank.swiftCode?.trim();
    if (!hasBic && !hasSwift) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Необходимо указать БИК или SWIFT код",
        path: [index, "bic"],
      });
    }
  });
};

export const createOrganizationWithBanksSchema = organizationSchema.extend({
  banks: z
    .array(organizationBankSchema)
    .min(1, "Необходимо добавить минимум один банковский счёт")
    .superRefine(validateBankCodes),
});

export const updateOrganizationSchema = organizationSchema.partial();

export const updateOrganizationBankSchema = organizationBankSchema.partial().extend({
  id: z.number().optional(),
});

export const updateOrganizationWithBanksSchema = updateOrganizationSchema.extend({
  banks: z
    .array(
      organizationBankSchema.extend({
        id: z.number().optional(),
      })
    )
    .superRefine(validateBankCodes)
    .optional(),
});

export const editOrganizationWithBanksSchema = organizationSchema.extend({
  banks: z
    .array(
      organizationBankSchema.extend({
        id: z.number().optional(),
      })
    )
    .min(1, "Необходимо добавить минимум один банковский счёт")
    .superRefine(validateBankCodes),
});

export type OrganizationBankFormData = z.infer<typeof organizationBankSchema>;
export type OrganizationFormData = z.infer<typeof organizationSchema>;
export type CreateOrganizationWithBanksInput = z.infer<typeof createOrganizationWithBanksSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type UpdateOrganizationWithBanksInput = z.infer<typeof updateOrganizationWithBanksSchema>;
export type EditOrganizationWithBanksInput = z.infer<typeof editOrganizationWithBanksSchema>;

// --- Customer ---

export const customerOnboardSchema = z.object({
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
        const cleaned = val.replace(/[\s\-\(\)]/g, "");
        return /^(\+7|8)?\d{10}$/.test(cleaned);
      },
      { message: "Некорректный формат телефона" }
    ),
  kpp: z.string().optional(),
  ogrn: z.string().optional(),
  oktmo: z.string().optional(),
  okpo: z.string().optional(),
  bankName: z.string().optional(),
  bankNameI18n: localizedTextSchema.optional(),
  bankAddress: z.string().optional(),
  bankAddressI18n: localizedTextSchema.optional(),
  account: z.string().optional(),
  bic: z.string().optional(),
  corrAccount: z.string().optional(),
  bankCountry: z.string().optional(),
});

export type CustomerOnboardInput = z.infer<typeof customerOnboardSchema>;

// --- Contract ---

const percentFeeSchema = z
  .string()
  .optional()
  .refine(
    (val) => {
      if (!val || val === "") return true;
      const num = parseFloat(val);
      return !isNaN(num) && num >= 0 && num <= 100;
    },
    { message: "Комиссия должна быть числом от 0 до 100" }
  );

const fixedFeeSchema = z
  .string()
  .optional()
  .refine(
    (val) => {
      if (!val || val === "") return true;
      const num = parseFloat(val);
      return !isNaN(num) && num >= 0;
    },
    { message: "Комиссия должна быть положительным числом" }
  );

export const contractSchema = z.object({
  organizationId: z.string().uuid("Организация обязательна"),
  agentOrganizationBankDetailsId: z
    .number({ error: "Банк обязателен" })
    .int()
    .positive(),
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
