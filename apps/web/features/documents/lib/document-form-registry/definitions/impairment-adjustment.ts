import { ImpairmentAdjustmentInputSchema } from "@multihansa/reporting/ifrs-documents/contracts";

import { createAdjustmentDefinition } from "../shared";

export function createImpairmentAdjustmentDefinition() {
  return createAdjustmentDefinition({
    docType: "impairment_adjustment",
    label: "Корректировка обесценения",
    schema: ImpairmentAdjustmentInputSchema,
  });
}
