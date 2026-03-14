import { PeriodCloseSchema } from "../validation";
import type { IfrsDocumentCatalogEntry } from "./types";

export const periodCloseDocumentDefinition = {
  docType: "period_close",
  label: "Закрытие периода",
  family: "ifrs",
  docNoPrefix: "PCL",
  schema: PeriodCloseSchema,
  creatable: false,
  hasTypedForm: false,
  adminOnly: true,
  listed: true,
  formDefinition: null,
} satisfies IfrsDocumentCatalogEntry;
