import { EquityDistributionInputSchema } from "@bedrock/ifrs-documents/contracts";

import { createEquityDefinition } from "../shared";

export function createEquityDistributionDefinition() {
  return createEquityDefinition({
    docType: "equity_distribution",
    label: "Распределение капитала",
    schema: EquityDistributionInputSchema,
  });
}
