import type { DocumentModule } from "@bedrock/extension-documents-sdk";

import { IFRS_DOCUMENT_METADATA } from "../metadata";
import {
  IntercompanyInterestAccrualInputSchema,
  IntercompanyInterestAccrualSchema,
  type IntercompanyInterestAccrual,
} from "../validation";
import { createSimpleIfrsDocumentModule } from "./internal/simple-module";

export function createIntercompanyInterestAccrualDocumentModule(): DocumentModule<
  IntercompanyInterestAccrual,
  IntercompanyInterestAccrual
> {
  return createSimpleIfrsDocumentModule({
    docType: "intercompany_interest_accrual",
    docNoPrefix: IFRS_DOCUMENT_METADATA.intercompany_interest_accrual.docNoPrefix,
    title: "Начисление межкорпоративных процентов",
    createSchema: IntercompanyInterestAccrualInputSchema,
    updateSchema: IntercompanyInterestAccrualInputSchema,
    payloadSchema: IntercompanyInterestAccrualSchema,
  });
}
