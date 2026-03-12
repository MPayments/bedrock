import type { DocumentModule } from "@bedrock/documents";

import {
  COMMERCIAL_DOCUMENT_TYPE_ORDER,
  getCommercialDocumentDefinition,
} from "../contracts";
import type { CommercialModuleDeps } from "./internal/types";

export function createCommercialDocumentModules(
  deps: CommercialModuleDeps,
): DocumentModule[] {
  return COMMERCIAL_DOCUMENT_TYPE_ORDER.map((docType) => {
    const definition = getCommercialDocumentDefinition(docType);
    if (!definition) {
      throw new Error(
        `Missing commercial document definition for docType=${docType}`,
      );
    }

    return definition.createModule(deps);
  });
}
