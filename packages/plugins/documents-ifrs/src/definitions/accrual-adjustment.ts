import { AccrualAdjustmentInputSchema } from "../validation";
import { createAdjustmentDefinition } from "./shared";
import type { IfrsDocumentCatalogEntry } from "./types";

export const accrualAdjustmentDocumentDefinition = {
  docType: "accrual_adjustment",
  label: "Корректировка начислений",
  family: "ifrs",
  docNoPrefix: "AAC",
  schema: AccrualAdjustmentInputSchema,
  creatable: true,
  hasTypedForm: true,
  adminOnly: false,
  listed: false,
  formDefinition: createAdjustmentDefinition({
    docType: "accrual_adjustment",
    label: "Корректировка начислений",
    schema: AccrualAdjustmentInputSchema,
  }),
} satisfies IfrsDocumentCatalogEntry;
