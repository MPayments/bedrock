import type { DocumentFormDefinition } from "./document-form-registry/types";

export type {
  DocumentFormBreakpoint,
  DocumentFormDefinition,
  DocumentFormField,
  DocumentFormFieldOption,
  FinancialLineCalcMethod,
  FxQuotePreviewRequestMode,
  DocumentFormResponsiveCount,
  DocumentFormRow,
  DocumentFormRowField,
  DocumentFormSection,
  DocumentFormSectionLayout,
  DocumentFormValues,
} from "./document-form-registry/types";

export type DocumentFormDefinitions = readonly DocumentFormDefinition[];

export function getDocumentFormDefinition(
  docType: string,
  definitions: DocumentFormDefinitions = [],
): DocumentFormDefinition | null {
  return definitions.find((definition) => definition.docType === docType) ?? null;
}

export function getDocumentFormDefinitionForRole(input: {
  definitions?: DocumentFormDefinitions;
  docType: string;
  isAdmin: boolean;
}): DocumentFormDefinition | null {
  const definition = getDocumentFormDefinition(
    input.docType,
    input.definitions,
  );
  if (!definition) {
    return null;
  }

  if (definition.adminOnly && !input.isAdmin) {
    return null;
  }

  return definition;
}
