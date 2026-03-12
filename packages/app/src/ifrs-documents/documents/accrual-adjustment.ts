import type { DocumentModule } from "@bedrock/app/documents";

import { IFRS_DOCUMENT_METADATA } from "../metadata";
import {
  AccrualAdjustmentInputSchema,
  AccrualAdjustmentSchema,
  type AccrualAdjustment,
} from "../validation";
import { createSimpleIfrsDocumentModule } from "./internal/simple-module";

export function createAccrualAdjustmentDocumentModule(): DocumentModule<
  AccrualAdjustment,
  AccrualAdjustment
> {
  return createSimpleIfrsDocumentModule({
    docType: "accrual_adjustment",
    docNoPrefix: IFRS_DOCUMENT_METADATA.accrual_adjustment.docNoPrefix,
    title: "Корректировка начислений",
    createSchema: AccrualAdjustmentInputSchema,
    updateSchema: AccrualAdjustmentInputSchema,
    payloadSchema: AccrualAdjustmentSchema,
  });
}
