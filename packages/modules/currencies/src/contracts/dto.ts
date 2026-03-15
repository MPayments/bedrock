import { z } from "zod";

export const CurrencySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  code: z.string(),
  symbol: z.string(),
  precision: z.number().int().nonnegative(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const CurrencyOptionSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  label: z.string(),
});

export const CurrencyOptionsResponseSchema = z.object({
  data: z.array(CurrencyOptionSchema),
});

export type Currency = z.infer<typeof CurrencySchema>;
export type CurrencyOption = z.infer<typeof CurrencyOptionSchema>;
