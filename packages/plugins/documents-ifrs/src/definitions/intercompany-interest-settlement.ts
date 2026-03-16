import { IntercompanyInterestSettlementInputSchema } from "../validation";
import { createLoanLikeDefinition } from "./shared";
import type { IfrsDocumentCatalogEntry } from "./types";

export const intercompanyInterestSettlementDocumentDefinition = {
  docType: "intercompany_interest_settlement",
  label: "Расчет по межкорпоративным процентам",
  family: "ifrs",
  docNoPrefix: "IIS",
  schema: IntercompanyInterestSettlementInputSchema,
  creatable: true,
  hasTypedForm: true,
  adminOnly: false,
  listed: false,
  formDefinition: createLoanLikeDefinition({
    docType: "intercompany_interest_settlement",
    label: "Расчет по межкорпоративным процентам",
    schema: IntercompanyInterestSettlementInputSchema,
  }),
} satisfies IfrsDocumentCatalogEntry;
