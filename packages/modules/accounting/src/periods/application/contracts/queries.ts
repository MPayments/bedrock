import { z } from "zod";

import { AccountingPeriodDateTimeSchema } from "./zod";

export const IsOrganizationPeriodClosedInputSchema = z.object({
  organizationId: z.uuid(),
  occurredAt: AccountingPeriodDateTimeSchema,
});

export const ListClosedOrganizationIdsForPeriodInputSchema = z.object({
  organizationIds: z.array(z.uuid()),
  occurredAt: AccountingPeriodDateTimeSchema,
});

export type IsOrganizationPeriodClosedInput = z.infer<
  typeof IsOrganizationPeriodClosedInputSchema
>;
export type ListClosedOrganizationIdsForPeriodInput = z.infer<
  typeof ListClosedOrganizationIdsForPeriodInputSchema
>;
