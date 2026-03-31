import { z } from "zod";

export const localizedTextSchema = z.object({
  ru: z.string().optional(),
  en: z.string().optional(),
});

const bankProviderSnapshotSchema = z.object({
  address: z.string().optional(),
  country: z.string().optional(),
  name: z.string().optional(),
  routingCode: z.string().optional(),
});

const bankRequisiteSnapshotSchema = z.object({
  accountNo: z.string().optional(),
  beneficiaryName: z.string().optional(),
  corrAccount: z.string().optional(),
  iban: z.string().optional(),
});

function hasText(value: string | undefined) {
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
      hasText(input.bankProvider?.country) ||
      hasText(input.bankProvider?.routingCode) ||
      hasText(input.bankRequisite?.beneficiaryName) ||
      hasText(input.bankRequisite?.accountNo) ||
      hasText(input.bankRequisite?.corrAccount) ||
      hasText(input.bankRequisite?.iban),
  );
}

export const customerOnboardSchema = z
  .object({
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
    bankMode: z.enum(["existing", "manual"]),
    bankProviderId: z.preprocess(
      (value) => (value === "" ? null : value),
      z.string().uuid().nullable(),
    ),
    bankProvider: bankProviderSnapshotSchema,
    bankProviderI18n: z
      .object({
        address: localizedTextSchema.optional(),
        name: localizedTextSchema.optional(),
      })
      .optional(),
    bankRequisite: bankRequisiteSnapshotSchema,
  })
  .superRefine((data, ctx) => {
    if (
      data.bankMode === "existing" &&
      hasBankSignal(data) &&
      !data.bankProviderId
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["bankProviderId"],
        message: "Выберите банк из справочника или переключитесь на ручной ввод",
      });
    }
  });

export type CustomerOnboardInput = z.infer<typeof customerOnboardSchema>;
