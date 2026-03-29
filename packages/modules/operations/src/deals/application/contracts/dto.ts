import { z } from "zod";

import { createPaginatedListSchema } from "@bedrock/shared/core/pagination";

import { DEAL_STATUS_VALUES } from "../../domain/deal-status";

const LocalizedTextSchema = z
  .object({
    ru: z.string().nullable().optional(),
    en: z.string().nullable().optional(),
  })
  .nullable();

export const DealSchema = z.object({
  id: z.number().int(),
  applicationId: z.number().int(),
  calculationId: z.number().int(),
  counterpartyId: z.string().uuid().nullable(),
  agentOrganizationBankDetailsId: z.number().int(),
  status: z.enum(DEAL_STATUS_VALUES),
  invoiceNumber: z.string().nullable(),
  invoiceDate: z.string().nullable(),
  companyName: z.string().nullable(),
  companyNameI18n: LocalizedTextSchema,
  bankName: z.string().nullable(),
  bankNameI18n: LocalizedTextSchema,
  account: z.string().nullable(),
  swiftCode: z.string().nullable(),
  contractDate: z.string().nullable(),
  contractNumber: z.string().nullable(),
  costPrice: z.string().nullable(),
  closedAt: z.string().nullable(),
  comment: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Deal = z.infer<typeof DealSchema>;

export const AgentBonusSchema = z.object({
  id: z.number().int(),
  agentId: z.string(),
  dealId: z.number().int(),
  commission: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AgentBonus = z.infer<typeof AgentBonusSchema>;

export const DealDocumentSchema = z.object({
  id: z.number().int(),
  dealId: z.number().int(),
  fileName: z.string(),
  fileSize: z.number().int(),
  mimeType: z.string(),
  s3Key: z.string(),
  uploadedBy: z.string().nullable(),
  description: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type DealDocument = z.infer<typeof DealDocumentSchema>;

export const PaginatedDealsSchema = createPaginatedListSchema(DealSchema);

export type PaginatedDeals = z.infer<typeof PaginatedDealsSchema>;

export const DealListRowSchema = z.object({
  id: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  closedAt: z.string().nullable(),
  client: z.string(),
  clientId: z.number().int(),
  counterpartyId: z.string().uuid().nullable(),
  amount: z.number(),
  currency: z.string(),
  amountInBase: z.number(),
  baseCurrencyCode: z.string(),
  status: z.enum(DEAL_STATUS_VALUES),
  agentName: z.string(),
  comment: z.string().nullable(),
  feePercentage: z.number(),
});

export type DealListRow = z.infer<typeof DealListRowSchema>;

export const PaginatedDealListRowsSchema =
  createPaginatedListSchema(DealListRowSchema);

export type PaginatedDealListRows = z.infer<typeof PaginatedDealListRowsSchema>;

export interface DealWithDetails {
  deal: Deal;
  application: {
    id: number;
    clientId: number;
    counterpartyId: string | null;
    agentId: string | null;
    status: string;
    requestedAmount: string | null;
    requestedCurrency: string | null;
  };
  calculation: {
    id: number;
    originalAmount: string | null;
    currencyCode: string | null;
    baseCurrencyCode: string | null;
    rate: string | null;
    feePercentage: string | null;
    feeAmount: string | null;
    feeAmountInBase: string;
    additionalExpenses: string;
    additionalExpensesCurrencyCode: string | null;
    additionalExpensesInBase: string;
    totalInBase: string;
    totalWithExpensesInBase: string | null;
  } | null;
  client: {
    id: number;
    orgName: string;
    inn: string | null;
  } | null;
  agent: {
    id: string;
    name: string;
  } | null;
  latestBonus: AgentBonus | null;
}
