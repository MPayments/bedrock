import { z } from "zod";

import { RateSourceSchema } from "./zod";
import {
  currencySchema,
  positiveAmountSchema,
} from "../../../fees/application/contracts/zod";
import { positiveMinorAmountStringSchema } from "../../../quotes/application/contracts/zod";

const rateAmountInputSchema = z.union([
  positiveAmountSchema,
  positiveMinorAmountStringSchema.transform((value) => BigInt(value)),
]);

const rateDateInputSchema = z.union([
  z.date(),
  z.coerce.date(),
]).optional();

export const SetManualRateInputSchema = z
  .object({
    base: currencySchema,
    quote: currencySchema,
    rateNum: rateAmountInputSchema,
    rateDen: rateAmountInputSchema,
    asOf: rateDateInputSchema,
    source: z
      .string()
      .min(1)
      .max(100)
      .refine(
        (source) =>
          !["cbr", "investing", "xe"].includes(source.toLowerCase()),
        "source 'cbr', 'investing' and 'xe' are reserved for external provider sync",
      )
      .optional(),
  })
  .refine((data) => data.base !== data.quote, {
    message: "base and quote currencies must be different",
  });

export const SetManualRateResponseSchema = z.object({
  ok: z.boolean(),
});

export const SyncRatesFromSourceInputSchema = z.object({
  source: RateSourceSchema,
  force: z.boolean().optional(),
  now: z.date().optional(),
});

export type SetManualRateInput = z.infer<typeof SetManualRateInputSchema>;
export type SyncRatesFromSourceInput = z.infer<
  typeof SyncRatesFromSourceInputSchema
>;
