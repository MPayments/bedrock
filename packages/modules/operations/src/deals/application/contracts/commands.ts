import { z } from "zod";

import { DEAL_STATUS_VALUES } from "../../domain/deal-status";

const LocalizedTextSchema = z
  .object({
    ru: z.string().nullable().optional(),
    en: z.string().nullable().optional(),
  })
  .nullable()
  .optional();

export const CreateDealInputSchema = z.object({
  applicationId: z.number().int(),
  calculationId: z.number().int(),
  counterpartyId: z.string().uuid().optional(),
  agentOrganizationBankDetailsId: z.number().int(),
  invoiceNumber: z.string().nullable().optional(),
  invoiceDate: z.string().nullable().optional(),
  companyName: z.string().nullable().optional(),
  companyNameI18n: LocalizedTextSchema,
  bankName: z.string().nullable().optional(),
  bankNameI18n: LocalizedTextSchema,
  account: z.string().nullable().optional(),
  swiftCode: z.string().nullable().optional(),
  contractDate: z.string().nullable().optional(),
  contractNumber: z.string().nullable().optional(),
  costPrice: z.string().nullable().optional(),
  comment: z.string().nullable().optional(),
});

export type CreateDealInput = z.infer<typeof CreateDealInputSchema>;

export const UpdateDealStatusInputSchema = z.object({
  id: z.number().int(),
  status: z.enum(DEAL_STATUS_VALUES),
});

export type UpdateDealStatusInput = z.infer<
  typeof UpdateDealStatusInputSchema
>;

export const UpdateDealDetailsInputSchema = z.object({
  id: z.number().int(),
  counterpartyId: z.string().uuid().nullable().optional(),
  invoiceNumber: z.string().nullable().optional(),
  invoiceDate: z.string().nullable().optional(),
  companyName: z.string().nullable().optional(),
  companyNameI18n: LocalizedTextSchema,
  bankName: z.string().nullable().optional(),
  bankNameI18n: LocalizedTextSchema,
  account: z.string().nullable().optional(),
  swiftCode: z.string().nullable().optional(),
  contractDate: z.string().nullable().optional(),
  contractNumber: z.string().nullable().optional(),
  costPrice: z.string().nullable().optional(),
  comment: z.string().nullable().optional(),
});

export type UpdateDealDetailsInput = z.infer<
  typeof UpdateDealDetailsInputSchema
>;

export const SetAgentBonusInputSchema = z.object({
  agentId: z.string(),
  dealId: z.number().int(),
  commission: z.string(),
});

export type SetAgentBonusInput = z.infer<typeof SetAgentBonusInputSchema>;
