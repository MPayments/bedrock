import { z } from "zod";

import {
  feeDealDirectionSchema,
  feeDealFormSchema,
  feeOperationKindSchema,
  currencySchema,
} from "./zod";
import type {
  ResolveFeeRulesInput,
} from "../../domain/fee-types";

export const resolveFeeRulesInputSchema = z.object({
  operationKind: feeOperationKindSchema,
  at: z.date(),
  fromCurrency: currencySchema.optional(),
  toCurrency: currencySchema.optional(),
  dealDirection: feeDealDirectionSchema.optional(),
  dealForm: feeDealFormSchema.optional(),
});

export type { ResolveFeeRulesInput };
