import { z } from "zod";

import {
  FINANCIAL_RESULTS_COUNTERPARTY_LIST_CONTRACT,
  FINANCIAL_RESULTS_GROUP_LIST_CONTRACT,
  ListFinancialResultsByCounterpartyQuerySchema,
  ListFinancialResultsByGroupQuerySchema,
} from "./validation";

export {
  FINANCIAL_RESULTS_COUNTERPARTY_LIST_CONTRACT,
  FINANCIAL_RESULTS_GROUP_LIST_CONTRACT,
  ListFinancialResultsByCounterpartyQuerySchema,
  ListFinancialResultsByGroupQuerySchema,
};

export const FinancialResultSummaryByCurrencySchema = z.object({
  currency: z.string(),
  revenue: z.string(),
  expense: z.string(),
  net: z.string(),
});

export const FinancialResultsByCounterpartySchema = z.object({
  entityType: z.enum(["counterparty", "unattributed"]),
  counterpartyId: z.uuid().nullable(),
  counterpartyName: z.string().nullable(),
  currency: z.string(),
  revenue: z.string(),
  expense: z.string(),
  net: z.string(),
});

export const FinancialResultsByGroupSchema = z.object({
  groupId: z.uuid(),
  groupCode: z.string().nullable(),
  groupName: z.string().nullable(),
  currency: z.string(),
  revenue: z.string(),
  expense: z.string(),
  net: z.string(),
});

export const FinancialResultsByCounterpartyResponseSchema = z.object({
  data: z.array(FinancialResultsByCounterpartySchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  summaryByCurrency: z.array(FinancialResultSummaryByCurrencySchema),
});

export const FinancialResultsByGroupResponseSchema = z.object({
  data: z.array(FinancialResultsByGroupSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  summaryByCurrency: z.array(FinancialResultSummaryByCurrencySchema),
  unattributedByCurrency: z.array(FinancialResultSummaryByCurrencySchema),
});
