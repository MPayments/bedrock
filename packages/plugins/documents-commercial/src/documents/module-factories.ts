import type { DocumentModule } from "@bedrock/plugin-documents-sdk";

import type { CommercialModuleDeps } from "./internal/types";
import { createIncomingInvoiceDocumentModule } from "./incoming-invoice";
import { createOutgoingInvoiceDocumentModule } from "./outgoing-invoice";
import { createPaymentOrderDocumentModule } from "./payment-order";

export const COMMERCIAL_DOCUMENT_MODULE_FACTORIES = {
  incoming_invoice: createIncomingInvoiceDocumentModule,
  payment_order: createPaymentOrderDocumentModule,
  outgoing_invoice: createOutgoingInvoiceDocumentModule,
} as const satisfies Record<
  string,
  (deps: CommercialModuleDeps) => DocumentModule
>;
