import type { DocumentModule } from "@bedrock/documents";

import { IFRS_DOCUMENT_METADATA } from "../metadata";
import {
  IntercompanyLoanRepaymentInputSchema,
  IntercompanyLoanRepaymentSchema,
  type IntercompanyLoanRepayment,
} from "../validation";
import { createSimpleIfrsDocumentModule } from "./internal/simple-module";

export function createIntercompanyLoanRepaymentDocumentModule(): DocumentModule<
  IntercompanyLoanRepayment,
  IntercompanyLoanRepayment
> {
  return createSimpleIfrsDocumentModule({
    docType: "intercompany_loan_repayment",
    docNoPrefix: IFRS_DOCUMENT_METADATA.intercompany_loan_repayment.docNoPrefix,
    title: "Погашение межкорпоративного займа",
    createSchema: IntercompanyLoanRepaymentInputSchema,
    updateSchema: IntercompanyLoanRepaymentInputSchema,
    payloadSchema: IntercompanyLoanRepaymentSchema,
  });
}
