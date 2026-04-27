import { COMMERCIAL_DOCUMENT_DEFINITIONS } from "@bedrock/plugin-documents-commercial/contracts";
import type { DocumentFormDefinitions } from "@bedrock/sdk-documents-form-ui/lib/document-form-registry";

export const CRM_DOCUMENT_FORM_DEFINITIONS =
  COMMERCIAL_DOCUMENT_DEFINITIONS.flatMap((definition) =>
    definition.formDefinition ? [definition.formDefinition] : [],
  ) satisfies DocumentFormDefinitions;
