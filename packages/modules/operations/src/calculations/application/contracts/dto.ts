import { z } from "zod";

import { createPaginatedListSchema } from "@bedrock/shared/core/pagination";

export const CalculationSchema = z.object({
  id: z.number().int(),
  applicationId: z.number().int(),
  currencyCode: z.string(),
  originalAmount: z.string(),
  feePercentage: z.string(),
  feeAmount: z.string(),
  totalAmount: z.string(),
  rateSource: z.string(),
  rate: z.string(),
  additionalExpensesCurrencyCode: z.string().nullable(),
  additionalExpenses: z.string(),
  baseCurrencyCode: z.string(),
  feeAmountInBase: z.string(),
  totalInBase: z.string(),
  additionalExpensesInBase: z.string(),
  totalWithExpensesInBase: z.string(),
  calculationTimestamp: z.string(),
  sentToClient: z.number().int(),
  status: z.string(),
  fxQuoteId: z.string().nullable(),
  createdAt: z.string(),
});

export type Calculation = z.infer<typeof CalculationSchema>;

export const PaginatedCalculationsSchema =
  createPaginatedListSchema(CalculationSchema);

export type PaginatedCalculations = z.infer<
  typeof PaginatedCalculationsSchema
>;
