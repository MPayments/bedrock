import type { DocumentModule } from "@bedrock/application/documents";

import { getIfrsDocumentDefinition, IFRS_DOCUMENT_TYPE_ORDER } from "../contracts";
import type { IfrsModuleDeps } from "./internal/types";

export function createIfrsDocumentModules(deps: IfrsModuleDeps): DocumentModule[] {
  return IFRS_DOCUMENT_TYPE_ORDER.map((docType) => {
    const definition = getIfrsDocumentDefinition(docType);
    if (!definition) {
      throw new Error(`Missing IFRS document definition for docType=${docType}`);
    }

    return definition.createModule(deps);
  });
}
