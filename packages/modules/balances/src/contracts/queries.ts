import type { z } from "zod";

import { ListOrganizationLiquidityRowsInputSchema } from "./zod";

export interface LiquidityQueryRow {
  bookId: string;
  counterpartyId: string | null;
  currency: string;
  ledgerBalanceMinor: string;
  availableMinor: string;
  reservedMinor: string;
  pendingMinor: string;
}

export type ListOrganizationLiquidityRowsInput = z.infer<
  typeof ListOrganizationLiquidityRowsInputSchema
>;

export function validateListOrganizationLiquidityRowsInput(
  input: unknown,
): ListOrganizationLiquidityRowsInput {
  return ListOrganizationLiquidityRowsInputSchema.parse(input);
}
