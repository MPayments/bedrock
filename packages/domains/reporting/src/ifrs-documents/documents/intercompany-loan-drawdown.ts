import type { DocumentModule } from "@multihansa/documents/runtime";

import { IFRS_DOCUMENT_METADATA } from "../metadata";
import {
  IntercompanyLoanDrawdownInputSchema,
  IntercompanyLoanDrawdownSchema,
  type IntercompanyLoanDrawdown,
} from "../validation";
import { createSimpleIfrsDocumentModule } from "./internal/simple-module";

export function createIntercompanyLoanDrawdownDocumentModule(): DocumentModule<
  IntercompanyLoanDrawdown,
  IntercompanyLoanDrawdown
> {
  return createSimpleIfrsDocumentModule({
    docType: "intercompany_loan_drawdown",
    docNoPrefix: IFRS_DOCUMENT_METADATA.intercompany_loan_drawdown.docNoPrefix,
    title: "Выдача межкорпоративного займа",
    createSchema: IntercompanyLoanDrawdownInputSchema,
    updateSchema: IntercompanyLoanDrawdownInputSchema,
    payloadSchema: IntercompanyLoanDrawdownSchema,
  });
}
