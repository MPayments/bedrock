import type { DealFundingResolution } from "@bedrock/deals/contracts";
import type {
  Document,
  DocumentModuleRuntime,
} from "@bedrock/plugin-documents-sdk";

import type { FinancialLine } from "../../financial-lines";
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
    usedByRef: string;
    usedDocumentId: string | null;
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
  financialLines: FinancialLine[];
  fundingResolution: DealFundingResolution;
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
