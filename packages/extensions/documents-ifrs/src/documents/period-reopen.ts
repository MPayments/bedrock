import type { DocumentModule } from "@bedrock/extension-documents-sdk";

import { IFRS_DOCUMENT_METADATA } from "../metadata";
import {
  PeriodReopenSchema,
  type PeriodReopen,
} from "../validation";
import { createSimpleIfrsDocumentModule } from "./internal/simple-module";

export function createPeriodReopenDocumentModule(): DocumentModule<
  PeriodReopen,
  PeriodReopen
> {
  return createSimpleIfrsDocumentModule({
    docType: "period_reopen",
    docNoPrefix: IFRS_DOCUMENT_METADATA.period_reopen.docNoPrefix,
    title: "Переоткрытие периода",
    createSchema: PeriodReopenSchema,
    updateSchema: PeriodReopenSchema,
    payloadSchema: PeriodReopenSchema,
  });
}
