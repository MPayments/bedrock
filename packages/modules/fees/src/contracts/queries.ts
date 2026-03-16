import { z } from "zod";

import {
  feeDealDirectionSchema,
  feeDealFormSchema,
  feeOperationKindSchema,
  currencySchema,
  uuidSchema,
} from "./zod";
import type {
  GetQuoteFeeComponentsInput,
  ResolveFeeRulesInput,
} from "../domain/fee-types";

export const resolveFeeRulesInputSchema = z.object({
  operationKind: feeOperationKindSchema,
  at: z.date(),
  fromCurrency: currencySchema.optional(),
  toCurrency: currencySchema.optional(),
  dealDirection: feeDealDirectionSchema.optional(),
  dealForm: feeDealFormSchema.optional(),
});

export const getQuoteFeeComponentsSchema = z.object({
  quoteId: uuidSchema,
});

export type { GetQuoteFeeComponentsInput, ResolveFeeRulesInput };
