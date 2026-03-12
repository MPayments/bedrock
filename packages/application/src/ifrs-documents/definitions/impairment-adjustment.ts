import { ImpairmentAdjustmentInputSchema } from "../validation";
import { createAdjustmentDefinition } from "./shared";
import type { IfrsDocumentCatalogEntry } from "./types";

export const impairmentAdjustmentDocumentDefinition = {
  docType: "impairment_adjustment",
  label: "Корректировка обесценения",
  family: "ifrs",
  docNoPrefix: "AIM",
  schema: ImpairmentAdjustmentInputSchema,
  creatable: true,
  hasTypedForm: true,
  adminOnly: false,
  listed: false,
  formDefinition: createAdjustmentDefinition({
    docType: "impairment_adjustment",
    label: "Корректировка обесценения",
    schema: ImpairmentAdjustmentInputSchema,
  }),
} satisfies IfrsDocumentCatalogEntry;
