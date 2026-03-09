import { z } from "zod";

export {
  CurrencySchema,
  CURRENCIES_LIST_CONTRACT,
  ListCurrenciesQuerySchema,
  CreateCurrencyInputSchema,
  UpdateCurrencyInputSchema,
} from "./validation";

export type {
  Currency,
  ListCurrenciesQuery,
  CreateCurrencyInput,
  UpdateCurrencyInput,
} from "./validation";

export const CurrencyOptionSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  label: z.string(),
});

export const CurrencyOptionsResponseSchema = z.object({
  data: z.array(CurrencyOptionSchema),
});

export type CurrencyOption = z.infer<typeof CurrencyOptionSchema>;
