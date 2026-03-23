import type {
  DocumentSnapshot,
  DocumentModuleRuntime,
} from "@bedrock/plugin-documents-sdk";

import type { QuoteSnapshot } from "../../validation";

export type CommercialDocumentRuntime = DocumentModuleRuntime;
export type CommercialDocumentDb = CommercialDocumentRuntime;

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
    runtime: CommercialDocumentRuntime;
    quoteRef: string;
  }): Promise<QuoteSnapshot>;
  createQuoteSnapshot(input: {
    runtime: CommercialDocumentRuntime;
    fromCurrency: string;
    toCurrency: string;
    fromAmountMinor: string;
    asOf: Date;
    idempotencyKey: string;
  }): Promise<QuoteSnapshot>;
}

export interface CommercialQuoteUsagePort {
  markQuoteUsedForInvoice(input: {
    runtime: CommercialDocumentRuntime;
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

export interface CommercialPartyReferencesPort {
  assertCustomerExists(customerId: string): Promise<void>;
  assertCounterpartyExists(counterpartyId: string): Promise<void>;
}

export interface CommercialDocumentRelationsPort {
  loadInvoice(input: {
    runtime: CommercialDocumentRuntime;
    invoiceDocumentId: string;
    forUpdate?: boolean;
  }): Promise<DocumentSnapshot>;
  getInvoiceExchangeChild(input: {
    runtime: CommercialDocumentRuntime;
    invoiceDocumentId: string;
  }): Promise<DocumentSnapshot | null>;
  getInvoiceAcceptanceChild(input: {
    runtime: CommercialDocumentRuntime;
    invoiceDocumentId: string;
  }): Promise<DocumentSnapshot | null>;
  getExchangeAcceptance(input: {
    runtime: CommercialDocumentRuntime;
    exchangeDocumentId: string;
  }): Promise<DocumentSnapshot | null>;
}

export interface CommercialModuleDeps {
  documentRelations: CommercialDocumentRelationsPort;
  quoteSnapshot: CommercialQuoteSnapshotPort;
  quoteUsage: CommercialQuoteUsagePort;
  requisiteBindings: CommercialRequisiteBindingsPort;
  partyReferences: CommercialPartyReferencesPort;
}
