import type { DocumentModule } from "@bedrock/app/documents";

import { createCapitalFundingDocumentModule } from "./capital-funding";
import type { IfrsModuleDeps } from "./internal/types";
import { createPeriodCloseDocumentModule } from "./period-close";
import { createPeriodReopenDocumentModule } from "./period-reopen";
import { createTransferIntercompanyDocumentModule } from "./transfer-intercompany";
import { createTransferIntraDocumentModule } from "./transfer-intra";
import { createTransferResolutionDocumentModule } from "./transfer-resolution";

export function createIfrsDocumentModules(deps: IfrsModuleDeps): DocumentModule[] {
  return [
    createTransferIntraDocumentModule(deps),
    createTransferIntercompanyDocumentModule(deps),
    createTransferResolutionDocumentModule(deps),
    createCapitalFundingDocumentModule(deps),
    createPeriodCloseDocumentModule(),
    createPeriodReopenDocumentModule(),
  ];
}
