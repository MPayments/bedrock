import { RevaluationAdjustmentInputSchema } from "../validation";
import { createAdjustmentDefinition } from "./shared";
import type { IfrsDocumentCatalogEntry } from "./types";

export const revaluationAdjustmentDocumentDefinition = {
  docType: "revaluation_adjustment",
  label: "Корректировка переоценки",
  family: "ifrs",
  docNoPrefix: "ARV",
  schema: RevaluationAdjustmentInputSchema,
  creatable: true,
  hasTypedForm: true,
  adminOnly: false,
  listed: false,
  formDefinition: createAdjustmentDefinition({
    docType: "revaluation_adjustment",
    label: "Корректировка переоценки",
    schema: RevaluationAdjustmentInputSchema,
  }),
} satisfies IfrsDocumentCatalogEntry;
