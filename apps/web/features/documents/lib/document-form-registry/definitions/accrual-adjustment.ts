import { AccrualAdjustmentInputSchema } from "@bedrock/application/ifrs-documents/contracts";

import { createAdjustmentDefinition } from "../shared";

export function createAccrualAdjustmentDefinition() {
  return createAdjustmentDefinition({
    docType: "accrual_adjustment",
    label: "Корректировка начислений",
    schema: AccrualAdjustmentInputSchema,
  });
}
