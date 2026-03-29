import { z } from "zod";

export const localizedTextSchema = z.object({
  ru: z.string().optional(),
  en: z.string().optional(),
});

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
      { message: "ИНН должен содержать 10 или 12 цифр" },
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
        const cleaned = val.replace(/[\s()-]/g, "");
        return /^(\+7|8)?\d{10}$/.test(cleaned);
      },
      { message: "Некорректный формат телефона" },
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
