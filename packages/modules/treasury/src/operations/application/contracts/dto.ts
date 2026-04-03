import { z } from "zod";

import {
  TreasuryOperationKindSchema,
  TreasuryOperationStateSchema,
} from "./zod";

export const TreasuryOperationSchema = z.object({
  amountMinor: z.string().nullable(),
  counterAmountMinor: z.string().nullable(),
  counterCurrencyId: z.uuid().nullable(),
  createdAt: z.date(),
  currencyId: z.uuid().nullable(),
  customerId: z.uuid().nullable(),
  dealId: z.uuid().nullable(),
  id: z.uuid(),
  internalEntityOrganizationId: z.uuid().nullable(),
  kind: TreasuryOperationKindSchema,
  quoteId: z.uuid().nullable(),
  sourceRef: z.string(),
  state: TreasuryOperationStateSchema,
  updatedAt: z.date(),
});

export type TreasuryOperation = z.infer<typeof TreasuryOperationSchema>;
