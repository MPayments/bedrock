import { z } from "zod";

import { TreasuryOperationKindSchema } from "./zod";

export const CreatePlannedTreasuryOperationInputSchema = z.object({
  amountMinor: z.bigint().nullable().optional().default(null),
  counterAmountMinor: z.bigint().nullable().optional().default(null),
  counterCurrencyId: z.uuid().nullable().optional().default(null),
  currencyId: z.uuid().nullable().optional().default(null),
  customerId: z.uuid().nullable().optional().default(null),
  dealId: z.uuid(),
  id: z.uuid(),
  internalEntityOrganizationId: z.uuid().nullable().optional().default(null),
  kind: TreasuryOperationKindSchema,
  quoteId: z.uuid().nullable().optional().default(null),
  sourceRef: z.string().trim().min(1).max(255),
});

export type CreatePlannedTreasuryOperationInput = z.infer<
  typeof CreatePlannedTreasuryOperationInputSchema
>;
