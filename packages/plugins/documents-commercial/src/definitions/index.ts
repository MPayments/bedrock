import { acceptanceDocumentDefinition } from "./acceptance";
import { exchangeDocumentDefinition } from "./exchange";
import { invoiceDocumentDefinition } from "./invoice";

export const COMMERCIAL_DOCUMENT_CATALOG = [
  invoiceDocumentDefinition,
  exchangeDocumentDefinition,
  acceptanceDocumentDefinition,
] as const;
