import type { UserRole } from "@/lib/auth/types";
import type { TypedDocumentType } from "@/features/documents/lib/doc-types";

import { DOCUMENT_FORM_DEFINITIONS } from "./document-form-registry/definitions";
import type { DocumentFormDefinition } from "./document-form-registry/types";

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
} from "./document-form-registry/types";

const DOCUMENT_FORM_DEFINITION_BY_TYPE = new Map(
  DOCUMENT_FORM_DEFINITIONS.map((definition) => [
    definition.docType,
    definition,
  ]),
);

export function getDocumentFormDefinition(
  docType: string,
): DocumentFormDefinition | null {
  return (
    DOCUMENT_FORM_DEFINITION_BY_TYPE.get(docType as TypedDocumentType) ?? null
  );
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
