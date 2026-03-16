import { z } from "zod";

import { KNOWN_CURRENCY_CODES } from "../domain/catalog";

export const CreateCurrencyInputSchema = z.object({
  name: z.string().min(1, "name is required"),
  code: z
    .string()
    .min(1, "code is required")
    .transform((value) => value.trim().toUpperCase())
    .refine((code) => KNOWN_CURRENCY_CODES.has(code), "Unknown currency code"),
  symbol: z.string().min(1, "symbol is required"),
  precision: z.number().int().min(0, "precision can't be less than 0"),
});

export const UpdateCurrencyInputSchema = z.object({
  name: z.string().optional(),
  code: z
    .string()
    .transform((value) => value.trim().toUpperCase())
    .refine((code) => KNOWN_CURRENCY_CODES.has(code), "Unknown currency code")
    .optional(),
  symbol: z.string().optional(),
  precision: z.number().int().min(0, "precision can't be less than 0").optional(),
});

export type CreateCurrencyInput = z.infer<typeof CreateCurrencyInputSchema>;
export type UpdateCurrencyInput = z.infer<typeof UpdateCurrencyInputSchema>;
