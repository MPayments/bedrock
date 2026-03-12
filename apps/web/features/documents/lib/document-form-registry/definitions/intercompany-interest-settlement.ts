import { IntercompanyInterestSettlementInputSchema } from "@bedrock/app/ifrs-documents/contracts";

import { createLoanLikeDefinition } from "../shared";

export function createIntercompanyInterestSettlementDefinition() {
  return createLoanLikeDefinition({
    docType: "intercompany_interest_settlement",
    label: "Расчет по межкорпоративным процентам",
    schema: IntercompanyInterestSettlementInputSchema,
  });
}
