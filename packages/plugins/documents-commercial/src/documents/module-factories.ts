import type { DocumentModule } from "@bedrock/plugin-documents-sdk";

import { createAcceptanceDocumentModule } from "./acceptance";
import { createExchangeDocumentModule } from "./exchange";
import type { CommercialModuleDeps } from "./internal/types";
import { createInvoiceDocumentModule } from "./invoice";

export const COMMERCIAL_DOCUMENT_MODULE_FACTORIES = {
  invoice: createInvoiceDocumentModule,
  exchange: createExchangeDocumentModule,
  acceptance: createAcceptanceDocumentModule,
} as const satisfies Record<
  string,
  (deps: CommercialModuleDeps) => DocumentModule
>;
