import { incomingInvoiceDocumentDefinition } from "./incoming-invoice";
import { outgoingInvoiceDocumentDefinition } from "./outgoing-invoice";
import { paymentOrderDocumentDefinition } from "./payment-order";

export const COMMERCIAL_DOCUMENT_CATALOG = [
  incomingInvoiceDocumentDefinition,
  paymentOrderDocumentDefinition,
  outgoingInvoiceDocumentDefinition,
] as const;
