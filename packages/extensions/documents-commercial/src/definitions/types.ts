import type { DocumentModule } from "@bedrock/extension-documents-sdk";
import type {
  DocumentCatalogEntry,
  DocumentFormBreakpoint,
  DocumentFormDefinition as GenericDocumentFormDefinition,
  DocumentFormField,
  DocumentFormFieldOption,
  DocumentFormResponsiveCount,
  DocumentFormRow,
  DocumentFormRowField,
  DocumentFormSection,
  DocumentFormSectionLayout,
  DocumentFormValues,
} from "@bedrock/extension-documents-sdk/form-types";

import type { CommercialDocumentFamily, CommercialDocumentType } from "../types";
import type { CommercialModuleDeps } from "../documents/internal/types";

export type DocumentFormDefinition = GenericDocumentFormDefinition<
  CommercialDocumentType,
  CommercialDocumentFamily
>;

export type CommercialDocumentCatalogEntry = DocumentCatalogEntry<
  CommercialDocumentType,
  CommercialDocumentFamily
>;

export type CommercialDocumentDefinition = CommercialDocumentCatalogEntry & {
  createModule: (deps: CommercialModuleDeps) => DocumentModule;
};

export type {
  DocumentFormBreakpoint,
  DocumentFormField,
  DocumentFormFieldOption,
  DocumentFormResponsiveCount,
  DocumentFormRow,
  DocumentFormRowField,
  DocumentFormSection,
  DocumentFormSectionLayout,
  DocumentFormValues,
};
