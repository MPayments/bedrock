import { IntercompanyLoanDrawdownInputSchema } from "@bedrock/application/ifrs-documents/contracts";

import { createLoanLikeDefinition } from "../shared";

export function createIntercompanyLoanDrawdownDefinition() {
  return createLoanLikeDefinition({
    docType: "intercompany_loan_drawdown",
    label: "Выдача межкорпоративного займа",
    schema: IntercompanyLoanDrawdownInputSchema,
  });
}
