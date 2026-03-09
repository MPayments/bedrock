import { z } from "zod";

import {
  baseOccurredAtSchema,
  periodBoundarySchema,
} from "./shared";

export const PeriodReopenSchema = baseOccurredAtSchema.extend({
  counterpartyId: z.uuid(),
  periodStart: periodBoundarySchema,
  periodEnd: periodBoundarySchema.optional(),
  reopenReason: z.string().trim().max(500).optional(),
});

export type PeriodReopen = z.infer<typeof PeriodReopenSchema>;
