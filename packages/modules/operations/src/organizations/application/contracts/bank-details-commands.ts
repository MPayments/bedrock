import { z } from "zod";

const LocalizedTextSchema = z
  .object({
    ru: z.string().nullable().optional(),
    en: z.string().nullable().optional(),
  })
  .nullable()
  .optional();

export const CreateBankDetailsInputSchema = z.object({
  organizationId: z.number().int(),
  name: z.string().nullable().optional(),
  nameI18n: LocalizedTextSchema,
  bankName: z.string().nullable().optional(),
  bankNameI18n: LocalizedTextSchema,
  bankAddress: z.string().nullable().optional(),
  bankAddressI18n: LocalizedTextSchema,
  account: z.string().nullable().optional(),
  bic: z.string().nullable().optional(),
  corrAccount: z.string().nullable().optional(),
  swiftCode: z.string().nullable().optional(),
  currencyCode: z.string().default("RUB"),
});

export type CreateBankDetailsInput = z.infer<
  typeof CreateBankDetailsInputSchema
>;

export const UpdateBankDetailsInputSchema =
  CreateBankDetailsInputSchema.partial().extend({
    id: z.number().int(),
  });

export type UpdateBankDetailsInput = z.infer<
  typeof UpdateBankDetailsInputSchema
>;
