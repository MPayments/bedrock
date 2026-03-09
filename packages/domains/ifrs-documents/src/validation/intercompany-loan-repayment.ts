import type { z } from "zod";

import {
  IntercompanyLoanDrawdownInputSchema,
  IntercompanyLoanDrawdownSchema,
} from "./intercompany-loan-drawdown";

export const IntercompanyLoanRepaymentInputSchema =
  IntercompanyLoanDrawdownInputSchema;

export const IntercompanyLoanRepaymentSchema = IntercompanyLoanDrawdownSchema;

export type IntercompanyLoanRepaymentInput = z.infer<
  typeof IntercompanyLoanRepaymentInputSchema
>;
export type IntercompanyLoanRepayment = z.infer<
  typeof IntercompanyLoanRepaymentSchema
>;
