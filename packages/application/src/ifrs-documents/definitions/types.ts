import type { DocumentModule } from "@bedrock/application/documents";
import type {
  DocumentCatalogEntry,
  DocumentFormBreakpoint as GenericDocumentFormBreakpoint,
  DocumentFormDefinition as GenericDocumentFormDefinition,
  DocumentFormField as GenericDocumentFormField,
  DocumentFormFieldOption as GenericDocumentFormFieldOption,
  DocumentFormResponsiveCount as GenericDocumentFormResponsiveCount,
  DocumentFormRow as GenericDocumentFormRow,
  DocumentFormRowField as GenericDocumentFormRowField,
  DocumentFormSection as GenericDocumentFormSection,
  DocumentFormSectionLayout as GenericDocumentFormSectionLayout,
  DocumentFormValues as GenericDocumentFormValues,
} from "@bedrock/application/documents/form-types";

import type { IfrsModuleDeps } from "../documents/internal/types";
import type { IfrsDocumentFamily, IfrsDocumentType } from "../types";

export type DocumentFormBreakpoint = GenericDocumentFormBreakpoint;
export type DocumentFormField = GenericDocumentFormField;
export type DocumentFormFieldOption = GenericDocumentFormFieldOption;
export type DocumentFormResponsiveCount = GenericDocumentFormResponsiveCount;
export type DocumentFormRow = GenericDocumentFormRow;
export type DocumentFormRowField = GenericDocumentFormRowField;
export type DocumentFormSection = GenericDocumentFormSection;
export type DocumentFormSectionLayout = GenericDocumentFormSectionLayout;
export type DocumentFormValues = GenericDocumentFormValues;
export type DocumentFormDefinition = GenericDocumentFormDefinition<
  IfrsDocumentType,
  IfrsDocumentFamily
>;
export type IfrsDocumentCatalogEntry = DocumentCatalogEntry<
  IfrsDocumentType,
  IfrsDocumentFamily
>;

export type IfrsDocumentDefinition = IfrsDocumentCatalogEntry & {
  createModule: (deps: IfrsModuleDeps) => DocumentModule;
};
