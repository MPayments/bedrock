import { z } from "zod";

export const CreateCalculationInputSchema = z.object({
  applicationId: z.number().int(),
  currencyCode: z.string(),
  originalAmount: z.string(),
  feePercentage: z.string(),
  feeAmount: z.string(),
  totalAmount: z.string(),
  rateSource: z.string(),
  rate: z.string(),
  additionalExpensesCurrencyCode: z.string().nullable().optional(),
  additionalExpenses: z.string(),
  baseCurrencyCode: z.string().default("RUB"),
  feeAmountInBase: z.string(),
  totalInBase: z.string(),
  additionalExpensesInBase: z.string(),
  totalWithExpensesInBase: z.string(),
  calculationTimestamp: z.string(),
});

export type CreateCalculationInput = z.infer<
  typeof CreateCalculationInputSchema
>;
