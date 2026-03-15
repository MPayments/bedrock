import type { z } from "zod";

import {
  adjustmentComponentSchema,
  feeComponentSchema,
  fxQuoteFeeCalculationSchema,
  getQuoteFeeComponentsSchema,
  resolveFeeRulesInputSchema,
  saveQuoteFeeComponentsSchema,
  upsertFeeRuleSchema,
  type AdjustmentComponent,
  type CalculateFxQuoteFeeComponentsInput,
  type FeeComponent,
  type GetQuoteFeeComponentsInput,
  type ResolveFeeRulesInput,
  type SaveQuoteFeeComponentsInput,
  type UpsertFeeRuleInput,
} from "../contracts";
import { FeeValidationError } from "../errors";

export function validateFeeComponent(input: unknown): FeeComponent {
  return validateInput(feeComponentSchema, input, "feeComponent");
}

export function validateAdjustmentComponent(input: unknown): AdjustmentComponent {
  return validateInput(adjustmentComponentSchema, input, "adjustmentComponent");
}

export function validateUpsertFeeRuleInput(input: unknown): UpsertFeeRuleInput {
  return validateInput(upsertFeeRuleSchema, input, "upsertFeeRule");
}

export function validateResolveFeeRulesInput(
  input: unknown,
): ResolveFeeRulesInput {
  return validateInput(resolveFeeRulesInputSchema, input, "resolveFeeRules");
}

export function validateFxQuoteFeeCalculation(
  input: unknown,
): CalculateFxQuoteFeeComponentsInput {
  return validateInput(
    fxQuoteFeeCalculationSchema,
    input,
    "calculateFxQuoteFeeComponents",
  );
}

export function validateSaveQuoteFeeComponentsInput(
  input: unknown,
): SaveQuoteFeeComponentsInput {
  return validateInput(
    saveQuoteFeeComponentsSchema,
    input,
    "saveQuoteFeeComponents",
  );
}

export function validateGetQuoteFeeComponentsInput(
  input: unknown,
): GetQuoteFeeComponentsInput {
  return validateInput(
    getQuoteFeeComponentsSchema,
    input,
    "getQuoteFeeComponents",
  );
}

export function validateInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown,
  context?: string,
): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    const errors = result.error.issues;
    if (!errors || errors.length === 0) {
      throw new FeeValidationError(
        `Validation failed${context ? ` for ${context}` : ""}: ${result.error.message || "Unknown error"}`,
      );
    }

    const firstError = errors[0]!;
    const path = firstError.path.join(".");
    const message = path
      ? `${path}: ${firstError.message}`
      : firstError.message;

    throw new FeeValidationError(`${context ? `${context}: ` : ""}${message}`);
  }

  return result.data;
}
