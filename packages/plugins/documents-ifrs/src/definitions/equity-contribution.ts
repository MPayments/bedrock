import { EquityContributionInputSchema } from "../validation";
import { createEquityDefinition } from "./shared";
import type { IfrsDocumentCatalogEntry } from "./types";

export const equityContributionDocumentDefinition = {
  docType: "equity_contribution",
  label: "Вклад в капитал",
  family: "ifrs",
  docNoPrefix: "ECO",
  schema: EquityContributionInputSchema,
  creatable: true,
  hasTypedForm: true,
  adminOnly: false,
  listed: false,
  formDefinition: createEquityDefinition({
    docType: "equity_contribution",
    label: "Вклад в капитал",
    schema: EquityContributionInputSchema,
  }),
} satisfies IfrsDocumentCatalogEntry;
