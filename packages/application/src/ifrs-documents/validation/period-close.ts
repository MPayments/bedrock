import { z } from "zod";

import {
  baseOccurredAtSchema,
  periodBoundarySchema,
} from "./shared";

export const PeriodCloseSchema = baseOccurredAtSchema.extend({
  counterpartyId: z.uuid(),
  periodStart: periodBoundarySchema,
  periodEnd: periodBoundarySchema,
  closeReason: z.string().trim().max(500).optional(),
});

export type PeriodClose = z.infer<typeof PeriodCloseSchema>;
