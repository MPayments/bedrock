import { ClosingReclassInputSchema } from "@multihansa/reporting/ifrs-documents/contracts";

import { createAdjustmentDefinition } from "../shared";

export function createClosingReclassDefinition() {
  return createAdjustmentDefinition({
    docType: "closing_reclass",
    label: "Закрывающая реклассификация",
    schema: ClosingReclassInputSchema,
  });
}
