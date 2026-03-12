import { IntercompanyLoanDrawdownInputSchema } from "../validation";
import { createLoanLikeDefinition } from "./shared";
import type { IfrsDocumentCatalogEntry } from "./types";

export const intercompanyLoanDrawdownDocumentDefinition = {
  docType: "intercompany_loan_drawdown",
  label: "Выдача межкорпоративного займа",
  family: "ifrs",
  docNoPrefix: "ILD",
  schema: IntercompanyLoanDrawdownInputSchema,
  creatable: true,
  hasTypedForm: true,
  adminOnly: false,
  listed: false,
  formDefinition: createLoanLikeDefinition({
    docType: "intercompany_loan_drawdown",
    label: "Выдача межкорпоративного займа",
    schema: IntercompanyLoanDrawdownInputSchema,
  }),
} satisfies IfrsDocumentCatalogEntry;
