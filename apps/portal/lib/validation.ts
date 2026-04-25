import { z } from "zod";

const localizedTextSchema = z.object({
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
  iban: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val === "") return true;
        return /^[A-Z0-9]{15,34}$/i.test(val);
      },
      { message: "IBAN должен содержать от 15 до 34 символов" },
    ),
});

function hasText(value: string | undefined) {
  return Boolean(value?.trim());
}

export function composePersonFullName(input: {
  personFirstName?: string;
  personLastName?: string;
  personMiddleName?: string;
}) {
  return [
    input.personLastName?.trim(),
    input.personFirstName?.trim(),
    input.personMiddleName?.trim(),
  ]
    .filter((part) => Boolean(part))
    .join(" ");
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
      hasText(input.bankRequisite?.iban),
  );
}

export const customerOnboardSchema = z
  .object({
    counterpartyKind: z.enum(["legal_entity", "individual"]),
    name: z.string().min(2, "Имя должно содержать минимум 2 символа").max(255),
    orgName: z.string(),
    orgNameI18n: localizedTextSchema.optional(),
    orgType: z.string().optional(),
    orgTypeI18n: localizedTextSchema.optional(),
    personFirstName: z.string().optional(),
    personLastName: z.string().optional(),
    personMiddleName: z.string().optional(),
    personFullNameI18n: localizedTextSchema.optional(),
    inn: z.string().refine(
      (val) => {
        if (!val) return true;
        if (!/^\d+$/.test(val)) return false;
        return val.length === 10 || val.length === 12;
      },
      { message: "ИНН должен содержать 10 или 12 цифр" },
    ),
    directorName: z.string(),
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
    if (data.counterpartyKind === "legal_entity") {
      if (!hasText(data.orgName)) {
        ctx.addIssue({
          code: "custom",
          path: ["orgName"],
          message: "Название организации обязательно",
        });
      }

      if (!hasText(data.inn)) {
        ctx.addIssue({
          code: "custom",
          path: ["inn"],
          message: "ИНН обязателен",
        });
      }

      if (!hasText(data.directorName)) {
        ctx.addIssue({
          code: "custom",
          path: ["directorName"],
          message: "ФИО директора обязательно",
        });
      }
    } else {
      if (!hasText(data.personLastName)) {
        ctx.addIssue({
          code: "custom",
          path: ["personLastName"],
          message: "Фамилия обязательна",
        });
      }

      if (!hasText(data.personFirstName)) {
        ctx.addIssue({
          code: "custom",
          path: ["personFirstName"],
          message: "Имя обязательно",
        });
      }
    }

    if (!hasBankSignal(data)) {
      return;
    }

    if (data.bankMode === "existing" && !data.bankProviderId) {
      ctx.addIssue({
        code: "custom",
        path: ["bankProviderId"],
        message: "Выберите банк из справочника или переключитесь на ручной ввод",
      });
    }

    if (data.bankMode === "manual") {
      if (!hasText(data.bankProvider.name)) {
        ctx.addIssue({
          code: "custom",
          path: ["bankProvider", "name"],
          message: "Название банка обязательно",
        });
      }

      if (!hasText(data.bankProvider.country)) {
        ctx.addIssue({
          code: "custom",
          path: ["bankProvider", "country"],
          message: "Страна банка обязательна",
        });
      }

      if (!hasText(data.bankProvider.routingCode)) {
        ctx.addIssue({
          code: "custom",
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
          code: "custom",
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
        code: "custom",
        path: ["bankRequisite", "beneficiaryName"],
        message: "Получатель обязателен",
      });
    }

    if (!hasText(data.bankRequisite.accountNo)) {
      ctx.addIssue({
        code: "custom",
        path: ["bankRequisite", "accountNo"],
        message: "Номер счета обязателен",
      });
    }
  });

export type CustomerOnboardInput = z.infer<typeof customerOnboardSchema>;
