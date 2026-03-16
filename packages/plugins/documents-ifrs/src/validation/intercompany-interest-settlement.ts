import type { z } from "zod";

import {
  IntercompanyLoanDrawdownInputSchema,
  IntercompanyLoanDrawdownSchema,
} from "./intercompany-loan-drawdown";

export const IntercompanyInterestSettlementInputSchema =
  IntercompanyLoanDrawdownInputSchema;

export const IntercompanyInterestSettlementSchema =
  IntercompanyLoanDrawdownSchema;

export type IntercompanyInterestSettlementInput = z.infer<
  typeof IntercompanyInterestSettlementInputSchema
>;
export type IntercompanyInterestSettlement = z.infer<
  typeof IntercompanyInterestSettlementSchema
>;
