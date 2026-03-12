import { EquityContributionInputSchema } from "@bedrock/application/ifrs-documents/contracts";

import { createEquityDefinition } from "../shared";

export function createEquityContributionDefinition() {
  return createEquityDefinition({
    docType: "equity_contribution",
    label: "Вклад в капитал",
    schema: EquityContributionInputSchema,
  });
}
