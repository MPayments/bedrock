import type { DocumentModule } from "@bedrock/documents";

import { createAcceptanceDocumentModule } from "./acceptance";
import { createExchangeDocumentModule } from "./exchange";
import { createInvoiceDocumentModule } from "./invoice";
import type { CommercialModuleDeps } from "./internal/types";

export const COMMERCIAL_DOCUMENT_MODULE_FACTORIES = {
  invoice: createInvoiceDocumentModule,
  exchange: createExchangeDocumentModule,
  acceptance: () => createAcceptanceDocumentModule(),
} as const satisfies Record<
  string,
  (deps: CommercialModuleDeps) => DocumentModule
>;
