import { RevaluationAdjustmentInputSchema } from "@multihansa/reporting/ifrs-documents/contracts";

import { createAdjustmentDefinition } from "../shared";

export function createRevaluationAdjustmentDefinition() {
  return createAdjustmentDefinition({
    docType: "revaluation_adjustment",
    label: "Корректировка переоценки",
    schema: RevaluationAdjustmentInputSchema,
  });
}
