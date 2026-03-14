import { z } from "zod";

import { AccountingPeriodDateTimeSchema } from "./zod";

export const ClosePeriodInputSchema = z.object({
  organizationId: z.uuid(),
  periodStart: AccountingPeriodDateTimeSchema,
  periodEnd: AccountingPeriodDateTimeSchema,
  closedBy: z.string().min(1),
  closeReason: z.string().nullable().optional(),
  closeDocumentId: z.uuid(),
});

export const ReopenPeriodInputSchema = z.object({
  organizationId: z.uuid(),
  periodStart: AccountingPeriodDateTimeSchema,
  reopenedBy: z.string().min(1),
  reopenReason: z.string().nullable().optional(),
  reopenDocumentId: z.uuid().nullable().optional(),
});

export const AssertOrganizationPeriodsOpenInputSchema = z.object({
  occurredAt: AccountingPeriodDateTimeSchema,
  organizationIds: z.array(z.uuid()),
  docType: z.string().min(1),
});

export type ClosePeriodInput = z.infer<typeof ClosePeriodInputSchema>;
export type ReopenPeriodInput = z.infer<typeof ReopenPeriodInputSchema>;
export type AssertOrganizationPeriodsOpenInput = z.infer<
  typeof AssertOrganizationPeriodsOpenInputSchema
>;
