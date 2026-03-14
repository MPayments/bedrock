import type { DocumentModule } from "@bedrock/plugin-documents-sdk";

import { COMMERCIAL_DOCUMENT_TYPE_ORDER } from "../metadata";
import { COMMERCIAL_DOCUMENT_MODULE_FACTORIES } from "./module-factories";
import type { CommercialModuleDeps } from "./internal/types";

export function createCommercialDocumentModules(
  deps: CommercialModuleDeps,
): DocumentModule[] {
  return COMMERCIAL_DOCUMENT_TYPE_ORDER.map((docType) => {
    const createModule = COMMERCIAL_DOCUMENT_MODULE_FACTORIES[docType];
    if (!createModule) {
      throw new Error(
        `Missing commercial document definition for docType=${docType}`,
      );
    }

    return createModule(deps);
  });
}
