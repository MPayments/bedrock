import type { UserRole } from "@/lib/auth/types";

import { COMMERCIAL_DOCUMENT_DEFINITIONS } from "@bedrock/plugin-documents-commercial/contracts";
import { IFRS_DOCUMENT_DEFINITIONS } from "@bedrock/plugin-documents-ifrs/contracts";

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

const DOCUMENT_FORM_DEFINITION_BY_TYPE = new Map<string, DocumentFormDefinition>(
  [...IFRS_DOCUMENT_DEFINITIONS, ...COMMERCIAL_DOCUMENT_DEFINITIONS].flatMap((definition) =>
    definition.formDefinition
      ? [[definition.docType, definition.formDefinition] as const]
      : [],
  ),
);

function getDocumentFormDefinition(
  docType: string,
): DocumentFormDefinition | null {
  return DOCUMENT_FORM_DEFINITION_BY_TYPE.get(docType) ?? null;
}

export function getDocumentFormDefinitionForRole(input: {
  docType: string;
  role: UserRole;
}): DocumentFormDefinition | null {
  const definition = getDocumentFormDefinition(input.docType);
  if (!definition) {
    return null;
  }

  if (definition.adminOnly && input.role !== "admin") {
    return null;
  }

  return definition;
}
