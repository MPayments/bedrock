import type { IfrsDocumentCatalogEntry } from "./types";
import { FxResolutionInputSchema } from "../validation";

export const fxResolutionDocumentDefinition = {
  docType: "fx_resolution",
  label: "Разрешение казначейского FX",
  family: "ifrs",
  docNoPrefix: "FXR",
  schema: FxResolutionInputSchema,
  creatable: false,
  hasTypedForm: false,
  adminOnly: false,
  listed: true,
  formDefinition: null,
} satisfies IfrsDocumentCatalogEntry;
