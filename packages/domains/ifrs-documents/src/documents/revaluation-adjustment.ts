import type { DocumentModule } from "@bedrock/documents/runtime";

import { IFRS_DOCUMENT_METADATA } from "../metadata";
import {
  RevaluationAdjustmentInputSchema,
  RevaluationAdjustmentSchema,
  type RevaluationAdjustment,
} from "../validation";
import { createSimpleIfrsDocumentModule } from "./internal/simple-module";

export function createRevaluationAdjustmentDocumentModule(): DocumentModule<
  RevaluationAdjustment,
  RevaluationAdjustment
> {
  return createSimpleIfrsDocumentModule({
    docType: "revaluation_adjustment",
    docNoPrefix: IFRS_DOCUMENT_METADATA.revaluation_adjustment.docNoPrefix,
    title: "Корректировка переоценки",
    createSchema: RevaluationAdjustmentInputSchema,
    updateSchema: RevaluationAdjustmentInputSchema,
    payloadSchema: RevaluationAdjustmentSchema,
  });
}
