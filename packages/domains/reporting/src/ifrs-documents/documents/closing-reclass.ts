import type { DocumentModule } from "@multihansa/documents/runtime";

import { IFRS_DOCUMENT_METADATA } from "../metadata";
import {
  ClosingReclassInputSchema,
  ClosingReclassSchema,
  type ClosingReclass,
} from "../validation";
import { createSimpleIfrsDocumentModule } from "./internal/simple-module";

export function createClosingReclassDocumentModule(): DocumentModule<
  ClosingReclass,
  ClosingReclass
> {
  return createSimpleIfrsDocumentModule({
    docType: "closing_reclass",
    docNoPrefix: IFRS_DOCUMENT_METADATA.closing_reclass.docNoPrefix,
    title: "Закрывающая реклассификация",
    createSchema: ClosingReclassInputSchema,
    updateSchema: ClosingReclassInputSchema,
    payloadSchema: ClosingReclassSchema,
  });
}
