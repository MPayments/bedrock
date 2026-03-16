import { IntercompanyLoanRepaymentInputSchema } from "../validation";
import { createLoanLikeDefinition } from "./shared";
import type { IfrsDocumentCatalogEntry } from "./types";

export const intercompanyLoanRepaymentDocumentDefinition = {
  docType: "intercompany_loan_repayment",
  label: "Погашение межкорпоративного займа",
  family: "ifrs",
  docNoPrefix: "ILR",
  schema: IntercompanyLoanRepaymentInputSchema,
  creatable: true,
  hasTypedForm: true,
  adminOnly: false,
  listed: false,
  formDefinition: createLoanLikeDefinition({
    docType: "intercompany_loan_repayment",
    label: "Погашение межкорпоративного займа",
    schema: IntercompanyLoanRepaymentInputSchema,
  }),
} satisfies IfrsDocumentCatalogEntry;
