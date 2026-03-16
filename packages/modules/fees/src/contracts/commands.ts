import { z } from "zod";

import {
  feeAccountingTreatmentSchema,
  feeCalcMethodSchema,
  feeComponentSchema,
  feeDealDirectionSchema,
  feeDealFormSchema,
  feeOperationKindSchema,
  feeSettlementModeSchema,
  componentKindSchema,
  currencySchema,
  nonNegativeAmountSchema,
  nonNegativeIntegerSchema,
  positiveAmountSchema,
  uuidSchema,
} from "./zod";
import type {
  CalculateFxQuoteFeeComponentsInput,
  SaveQuoteFeeComponentsInput,
  UpsertFeeRuleInput,
} from "../domain/fee-types";

export const upsertFeeRuleSchema = z
  .object({
    name: z.string().min(1).max(255),
    operationKind: feeOperationKindSchema,
    feeKind: componentKindSchema,
    calcMethod: feeCalcMethodSchema,
    bps: nonNegativeIntegerSchema
      .max(10000, "bps cannot exceed 10000 (100%)")
      .optional(),
    fixedAmountMinor: nonNegativeAmountSchema.optional(),
    fixedCurrency: currencySchema.optional(),
    settlementMode: feeSettlementModeSchema.optional(),
    accountingTreatment: feeAccountingTreatmentSchema.optional(),
    dealDirection: feeDealDirectionSchema.optional(),
    dealForm: feeDealFormSchema.optional(),
    fromCurrency: currencySchema.optional(),
    toCurrency: currencySchema.optional(),
    priority: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
    effectiveFrom: z.date().optional(),
    effectiveTo: z.date().optional(),
    memo: z.string().max(1000).optional(),
    metadata: z.record(z.string(), z.string().max(255)).optional(),
  })
  .refine(
    (data) => {
      if (data.calcMethod === "bps") {
        return data.bps !== undefined && data.fixedAmountMinor === undefined;
      }

      return data.fixedAmountMinor !== undefined && data.bps === undefined;
    },
    {
      message:
        "calcMethod=bps requires bps and forbids fixedAmountMinor; calcMethod=fixed requires fixedAmountMinor",
      path: ["calcMethod"],
    },
  )
  .refine(
    (data) => {
      if (!data.effectiveTo || !data.effectiveFrom) {
        return true;
      }

      return data.effectiveTo.getTime() > data.effectiveFrom.getTime();
    },
    {
      message: "effectiveTo must be later than effectiveFrom",
      path: ["effectiveTo"],
    },
  );

export const fxQuoteFeeCalculationSchema = z.object({
  fromCurrency: currencySchema,
  toCurrency: currencySchema,
  principalMinor: positiveAmountSchema,
  at: z.date(),
  dealDirection: feeDealDirectionSchema.optional(),
  dealForm: feeDealFormSchema.optional(),
});

export const saveQuoteFeeComponentsSchema = z.object({
  quoteId: uuidSchema,
  components: z.array(feeComponentSchema),
});

export type {
  CalculateFxQuoteFeeComponentsInput,
  SaveQuoteFeeComponentsInput,
  UpsertFeeRuleInput,
};
