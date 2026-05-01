import { acceptanceDocumentDefinition } from "./acceptance";
import { applicationDocumentDefinition } from "./application";
import { exchangeDocumentDefinition } from "./exchange";
import { invoiceDocumentDefinition } from "./invoice";

export const COMMERCIAL_DOCUMENT_CATALOG = [
  applicationDocumentDefinition,
  invoiceDocumentDefinition,
  exchangeDocumentDefinition,
  acceptanceDocumentDefinition,
] as const;
