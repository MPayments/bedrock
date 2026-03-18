import type { DocumentModule } from "@bedrock/plugin-documents-sdk";

import { IFRS_DOCUMENT_METADATA } from "../metadata";
import {
  PeriodCloseSchema,
  type PeriodClose,
} from "../validation";
import { createSimpleIfrsDocumentModule } from "./internal/simple-module";

export function createPeriodCloseDocumentModule(): DocumentModule<
  PeriodClose,
  PeriodClose
> {
  return createSimpleIfrsDocumentModule({
    docType: "period_close",
    docNoPrefix: IFRS_DOCUMENT_METADATA.period_close.docNoPrefix,
    title: "Закрытие периода",
    approvalRequired: true,
    createSchema: PeriodCloseSchema,
    updateSchema: PeriodCloseSchema,
    payloadSchema: PeriodCloseSchema,
  });
}
