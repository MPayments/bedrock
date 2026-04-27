import { COMMERCIAL_DOCUMENT_DEFINITIONS } from "@bedrock/plugin-documents-commercial/contracts";
import { IFRS_DOCUMENT_DEFINITIONS } from "@bedrock/plugin-documents-ifrs/contracts";
import type { DocumentFormDefinitions } from "@bedrock/sdk-documents-form-ui/lib/document-form-registry";

export const DOCUMENT_FORM_DEFINITIONS = [
  ...IFRS_DOCUMENT_DEFINITIONS,
  ...COMMERCIAL_DOCUMENT_DEFINITIONS,
].flatMap((definition) =>
  definition.formDefinition ? [definition.formDefinition] : [],
) satisfies DocumentFormDefinitions;
