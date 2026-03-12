import { IntercompanyLoanRepaymentInputSchema } from "@multihansa/ifrs-documents/contracts";

import { createLoanLikeDefinition } from "../shared";

export function createIntercompanyLoanRepaymentDefinition() {
  return createLoanLikeDefinition({
    docType: "intercompany_loan_repayment",
    label: "Погашение межкорпоративного займа",
    schema: IntercompanyLoanRepaymentInputSchema,
  });
}
