import { IFRS_DOCUMENT_CATALOG } from "./definitions";
import type {
  DocumentFormBreakpoint,
  DocumentFormDefinition,
  DocumentFormField,
  DocumentFormFieldOption,
  DocumentFormResponsiveCount,
  DocumentFormRow,
  DocumentFormRowField,
  DocumentFormSection,
  DocumentFormSectionLayout,
  DocumentFormValues,
  IfrsDocumentDefinition,
} from "./definitions/types";
import { IFRS_DOCUMENT_MODULE_FACTORIES } from "./documents/module-factories";
import {
  IFRS_DOCUMENT_METADATA,
  IFRS_DOCUMENT_TYPE_ORDER,
  type IfrsDocumentType,
} from "./metadata";

export { IFRS_DOCUMENT_METADATA, IFRS_DOCUMENT_TYPE_ORDER, type IfrsDocumentType };
export type {
  DocumentFormBreakpoint,
  DocumentFormDefinition,
  DocumentFormField,
  DocumentFormFieldOption,
  DocumentFormResponsiveCount,
  DocumentFormRow,
  DocumentFormRowField,
  DocumentFormSection,
  DocumentFormSectionLayout,
  DocumentFormValues,
  IfrsDocumentDefinition,
};

export const IFRS_DOCUMENT_DEFINITIONS = IFRS_DOCUMENT_CATALOG.map((entry) => ({
  ...entry,
  createModule: IFRS_DOCUMENT_MODULE_FACTORIES[entry.docType],
})) as readonly IfrsDocumentDefinition[];

const IFRS_DOCUMENT_DEFINITION_BY_TYPE = new Map(
  IFRS_DOCUMENT_DEFINITIONS.map((definition) => [definition.docType, definition] as const),
);

export function getIfrsDocumentDefinition(docType: IfrsDocumentType) {
  return IFRS_DOCUMENT_DEFINITION_BY_TYPE.get(docType) ?? null;
}

export * from "./validation";
