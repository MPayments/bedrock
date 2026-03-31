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
      const cleaned = val.replace(/[\s-()]/g, "");
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
  subAgentCounterpartyId: z.string().uuid().optional(),
  contractNumber: z.string().optional(),
  contractDate: z.string().optional(),
  agentFee: z.string().optional(),
  fixedFee: z.string().optional(),
  organizationId: z.string().uuid().optional(),
  organizationRequisiteId: z.string().uuid().optional(),
});

export const updateClientSchema = createClientSchema.partial();

export type ClientFormData = z.infer<typeof clientSchema>;
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

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
        const cleaned = val.replace(/[\s-()]/g, "");
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
