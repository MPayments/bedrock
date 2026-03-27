import { z } from "zod";

import {
  currencySchema,
} from "../../../fees/application/contracts/zod";

export const GetRateHistoryInputSchema = z
  .object({
    base: currencySchema,
    quote: currencySchema,
    limit: z.coerce.number().int().positive().optional(),
    from: z.union([z.date(), z.coerce.date()]).optional(),
  })
  .refine((input) => input.base !== input.quote, {
    message: "base and quote currencies must be different",
  });

export type GetRateHistoryInput = z.infer<
  typeof GetRateHistoryInputSchema
>;
