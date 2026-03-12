import { ClosingReclassInputSchema } from "../validation";
import { createAdjustmentDefinition } from "./shared";
import type { IfrsDocumentCatalogEntry } from "./types";

export const closingReclassDocumentDefinition = {
  docType: "closing_reclass",
  label: "Закрывающая реклассификация",
  family: "ifrs",
  docNoPrefix: "ACR",
  schema: ClosingReclassInputSchema,
  creatable: true,
  hasTypedForm: true,
  adminOnly: false,
  listed: false,
  formDefinition: createAdjustmentDefinition({
    docType: "closing_reclass",
    label: "Закрывающая реклассификация",
    schema: ClosingReclassInputSchema,
  }),
} satisfies IfrsDocumentCatalogEntry;
