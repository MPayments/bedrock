import { z } from "zod";

import { createPaginatedListSchema } from "@bedrock/shared/core/pagination";

const LocalizedTextSchema = z
  .object({
    ru: z.string().nullable().optional(),
    en: z.string().nullable().optional(),
  })
  .nullable()
  .optional();

export const BankDetailsSchema = z.object({
  id: z.number().int(),
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
  currencyCode: z.string(),
  isActive: z.boolean(),
  requisiteId: z.string().uuid().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type BankDetails = z.infer<typeof BankDetailsSchema>;

export const PaginatedBankDetailsSchema =
  createPaginatedListSchema(BankDetailsSchema);

export type PaginatedBankDetails = z.infer<typeof PaginatedBankDetailsSchema>;
