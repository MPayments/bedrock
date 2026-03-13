import type { DocumentModule } from "@bedrock/documents";

import { IFRS_DOCUMENT_TYPE_ORDER } from "../metadata";
import { IFRS_DOCUMENT_MODULE_FACTORIES } from "./module-factories";
import type { IfrsModuleDeps } from "./internal/types";

export function createIfrsDocumentModules(deps: IfrsModuleDeps): DocumentModule[] {
  return IFRS_DOCUMENT_TYPE_ORDER.map((docType) => {
    const createModule = IFRS_DOCUMENT_MODULE_FACTORIES[docType];
    if (!createModule) {
      throw new Error(`Missing IFRS document definition for docType=${docType}`);
    }

    return createModule(deps);
  });
}
