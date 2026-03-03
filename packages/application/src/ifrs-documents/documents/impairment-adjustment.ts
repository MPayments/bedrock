import type { DocumentModule } from "@bedrock/core/documents";

import { IFRS_DOCUMENT_METADATA } from "../metadata";
import {
  ImpairmentAdjustmentInputSchema,
  ImpairmentAdjustmentSchema,
  type ImpairmentAdjustment,
} from "../validation";
import { createSimpleIfrsDocumentModule } from "./internal/simple-module";

export function createImpairmentAdjustmentDocumentModule(): DocumentModule<
  ImpairmentAdjustment,
  ImpairmentAdjustment
> {
  return createSimpleIfrsDocumentModule({
    docType: "impairment_adjustment",
    docNoPrefix: IFRS_DOCUMENT_METADATA.impairment_adjustment.docNoPrefix,
    title: "Корректировка обесценения",
    createSchema: ImpairmentAdjustmentInputSchema,
    updateSchema: ImpairmentAdjustmentInputSchema,
    payloadSchema: ImpairmentAdjustmentSchema,
  });
}
