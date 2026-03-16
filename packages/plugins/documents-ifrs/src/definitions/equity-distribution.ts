import { EquityDistributionInputSchema } from "../validation";
import { createEquityDefinition } from "./shared";
import type { IfrsDocumentCatalogEntry } from "./types";

export const equityDistributionDocumentDefinition = {
  docType: "equity_distribution",
  label: "Распределение капитала",
  family: "ifrs",
  docNoPrefix: "EDI",
  schema: EquityDistributionInputSchema,
  creatable: true,
  hasTypedForm: true,
  adminOnly: false,
  listed: false,
  formDefinition: createEquityDefinition({
    docType: "equity_distribution",
    label: "Распределение капитала",
    schema: EquityDistributionInputSchema,
  }),
} satisfies IfrsDocumentCatalogEntry;
