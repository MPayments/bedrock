import { z } from "zod";

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
