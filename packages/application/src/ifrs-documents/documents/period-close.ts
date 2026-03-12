import type { DocumentModule } from "@bedrock/application/documents";

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
    createSchema: PeriodCloseSchema,
    updateSchema: PeriodCloseSchema,
    payloadSchema: PeriodCloseSchema,
  });
}
