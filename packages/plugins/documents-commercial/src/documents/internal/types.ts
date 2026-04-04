import type {
  Document,
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
  }): Promise<Document>;
  getInvoiceExchangeChild(input: {
    runtime: CommercialDocumentRuntime;
    invoiceDocumentId: string;
  }): Promise<Document | null>;
  getInvoiceAcceptanceChild(input: {
    runtime: CommercialDocumentRuntime;
    invoiceDocumentId: string;
  }): Promise<Document | null>;
  getExchangeAcceptance(input: {
    runtime: CommercialDocumentRuntime;
    exchangeDocumentId: string;
  }): Promise<Document | null>;
}

export interface CommercialDocumentBusinessLinksPort {
  findDealIdByDocumentId(documentId: string): Promise<string | null>;
}

export interface CommercialDealFxContext {
  calculationCurrency: string | null;
  calculationId: string | null;
  dealId: string;
  dealType: string;
  financialLines: Array<{
    amountMinor: bigint;
    bucket:
      | "adjustment"
      | "fee_revenue"
      | "pass_through"
      | "provider_fee_expense"
      | "spread_revenue";
    currency: string;
    id: string;
    memo?: string;
    metadata?: Record<string, string>;
    settlementMode: "in_ledger";
    source: "rule";
  }>;
  hasConvertLeg: boolean;
  originalAmountMinor: string | null;
  quoteSnapshot: QuoteSnapshot | null;
  totalAmountMinor: string | null;
}

export interface CommercialDealFxPort {
  resolveDealFxContext(
    dealId: string,
  ): Promise<CommercialDealFxContext | null>;
}

export interface CommercialModuleDeps {
  dealFx: CommercialDealFxPort;
  documentBusinessLinks: CommercialDocumentBusinessLinksPort;
  documentRelations: CommercialDocumentRelationsPort;
  quoteSnapshot: CommercialQuoteSnapshotPort;
  quoteUsage: CommercialQuoteUsagePort;
  requisiteBindings: CommercialRequisiteBindingsPort;
  partyReferences: CommercialPartyReferencesPort;
}
