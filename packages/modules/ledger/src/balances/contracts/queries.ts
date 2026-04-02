import type { z } from "zod";

import type {
  ListOrganizationLiquidityRowsInputSchema,
  ListOrganizationRequisiteLiquidityRowsInputSchema,
} from "./zod";

export interface LiquidityQueryRow {
  bookId: string;
  counterpartyId: string | null;
  currency: string;
  ledgerBalanceMinor: string;
  availableMinor: string;
  reservedMinor: string;
  pendingMinor: string;
}

export interface OrganizationRequisiteLiquidityQueryRow {
  organizationId: string;
  requisiteId: string;
  currency: string;
  ledgerBalanceMinor: string;
  availableMinor: string;
  reservedMinor: string;
  pendingMinor: string;
}

export type ListOrganizationLiquidityRowsInput = z.infer<
  typeof ListOrganizationLiquidityRowsInputSchema
>;

export type ListOrganizationRequisiteLiquidityRowsInput = z.infer<
  typeof ListOrganizationRequisiteLiquidityRowsInputSchema
>;
