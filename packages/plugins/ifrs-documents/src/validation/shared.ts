import { z } from "zod";

import { amountValueSchema, toMinorAmountString } from "@bedrock/common/money";

export const currencyCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(16)
  .transform((value) => value.toUpperCase());

export const memoSchema = z.string().trim().max(1_000).optional();
export const referenceSchema = z.string().trim().min(1).max(255).optional();

export const baseOccurredAtSchema = z.object({
  occurredAt: z.coerce.date(),
});

export const periodBoundarySchema = z.coerce.date();

export function withAmountMinor<
  TInput extends { amount: string; currency: string },
>(
  input: TInput,
  ctx: z.RefinementCtx,
): (Omit<TInput, "amount"> & { amountMinor: string }) | typeof z.NEVER {
  try {
    const amountMinor = toMinorAmountString(input.amount, input.currency, {
      requirePositive: true,
    });
    const { amount: _amount, ...rest } = input;
    return {
      ...rest,
      amountMinor,
    };
  } catch (error) {
    ctx.addIssue({
      code: "custom",
      message: error instanceof Error ? error.message : "amount is invalid",
    });
    return z.NEVER;
  }
}

export const amountValueInputSchema = amountValueSchema;
