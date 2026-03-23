import type { z } from "zod";

import type {
  RateHistoryPointSchema,
  RatePairSchema,
  RateSourceSchema,
  RateSourceStatusSchema,
} from "./zod";

export type RateSource = z.infer<typeof RateSourceSchema>;
export type RatePair = z.infer<typeof RatePairSchema>;
export type RateHistoryPoint = z.infer<typeof RateHistoryPointSchema>;
export type RateSourceStatus = z.infer<typeof RateSourceStatusSchema>;
