import type { Document, DocumentModule } from "@bedrock/extension-documents-sdk";

import type { QuoteSnapshot } from "../../validation";

export type CommercialDocumentDb = Parameters<DocumentModule["canPost"]>[0]["db"];

export interface OrganizationRequisiteBinding {
  requisiteId: string;
  bookId: string;
  organizationId: string;
  currencyCode: string;
  postingAccountNo: string;
  bookAccountInstanceId: string;
}

export interface CommercialQuoteSnapshotPort {
  loadQuoteSnapshot(input: {
    db: CommercialDocumentDb;
    quoteRef: string;
  }): Promise<QuoteSnapshot>;
}

export interface CommercialQuoteUsagePort {
  markQuoteUsedForInvoice(input: {
    db: CommercialDocumentDb;
    quoteId: string;
    invoiceDocumentId: string;
    at: Date;
  }): Promise<void>;
}

export interface CommercialRequisiteBindingsPort {
  resolveBinding(
    organizationRequisiteId: string,
  ): Promise<OrganizationRequisiteBinding | null>;
}

export interface CommercialDocumentRelationsPort {
  loadInvoice(input: {
    db: CommercialDocumentDb;
    invoiceDocumentId: string;
    forUpdate?: boolean;
  }): Promise<Document>;
  getInvoiceExchangeChild(input: {
    db: CommercialDocumentDb;
    invoiceDocumentId: string;
  }): Promise<Document | null>;
  getInvoiceAcceptanceChild(input: {
    db: CommercialDocumentDb;
    invoiceDocumentId: string;
  }): Promise<Document | null>;
  getExchangeAcceptance(input: {
    db: CommercialDocumentDb;
    exchangeDocumentId: string;
  }): Promise<Document | null>;
}

export interface CommercialModuleDeps {
  documentRelations: CommercialDocumentRelationsPort;
  quoteSnapshot: CommercialQuoteSnapshotPort;
  quoteUsage: CommercialQuoteUsagePort;
  requisiteBindings: CommercialRequisiteBindingsPort;
}
