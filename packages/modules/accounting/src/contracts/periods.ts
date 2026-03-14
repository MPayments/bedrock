import { z } from "zod";

export const AccountingPeriodStateSchema = z.enum(["closed", "reopened"]);
export const AccountingClosePackageStateSchema = z.enum([
  "closed",
  "superseded",
]);

export const ClosePeriodInputSchema = z.object({
  organizationId: z.uuid(),
  periodStart: z.iso.datetime(),
  periodEnd: z.iso.datetime(),
  closedBy: z.string().min(1),
  closeReason: z.string().nullable().optional(),
  closeDocumentId: z.uuid(),
});

export const ReopenPeriodInputSchema = z.object({
  organizationId: z.uuid(),
  periodStart: z.iso.datetime(),
  reopenedBy: z.string().min(1),
  reopenReason: z.string().nullable().optional(),
  reopenDocumentId: z.uuid().nullable().optional(),
});

export const AssertOrganizationPeriodsOpenInputSchema = z.object({
  occurredAt: z.iso.datetime(),
  organizationIds: z.array(z.uuid()),
  docType: z.string().min(1),
});

export type ClosePeriodInput = z.infer<typeof ClosePeriodInputSchema>;
export type ReopenPeriodInput = z.infer<typeof ReopenPeriodInputSchema>;
export type AssertOrganizationPeriodsOpenInput = z.infer<
  typeof AssertOrganizationPeriodsOpenInputSchema
>;
