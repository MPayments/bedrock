import type { LedgerOperationDetails } from "@bedrock/ledger/contracts";
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
  markQuoteUsedForPaymentOrder(input: {
    runtime: CommercialDocumentRuntime;
    quoteId: string;
    paymentOrderDocumentId: string;
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
  assertCounterpartyLinkedToCustomer(input: {
    customerId: string;
    counterpartyId: string;
  }): Promise<void>;
}

export interface CommercialDocumentRelationsPort {
  loadIncomingInvoice(input: {
    runtime: CommercialDocumentRuntime;
    incomingInvoiceDocumentId: string;
    forUpdate?: boolean;
  }): Promise<DocumentSnapshot>;
  loadPaymentOrder(input: {
    runtime: CommercialDocumentRuntime;
    paymentOrderDocumentId: string;
    forUpdate?: boolean;
  }): Promise<DocumentSnapshot>;
  listIncomingInvoicePaymentOrders(input: {
    runtime: CommercialDocumentRuntime;
    incomingInvoiceDocumentId: string;
  }): Promise<DocumentSnapshot[]>;
  listPaymentOrderResolutions(input: {
    runtime: CommercialDocumentRuntime;
    paymentOrderDocumentId: string;
  }): Promise<DocumentSnapshot[]>;
}

export interface CommercialLedgerReadPort {
  getOperationDetails(operationId: string): Promise<LedgerOperationDetails | null>;
}

export interface CommercialTreasuryDocumentLink {
  linkKind: "instruction" | "obligation" | "operation";
  targetId: string;
}

export interface CommercialTreasuryStatePort {
  ensureIncomingInvoiceObligation(input: {
    document: DocumentSnapshot;
  }): Promise<{ obligationId: string }>;
  ensureOutgoingInvoiceObligation(input: {
    document: DocumentSnapshot;
  }): Promise<{ obligationId: string }>;
  ensurePaymentOrderPayout(input: {
    document: DocumentSnapshot;
  }): Promise<{
    operationId: string;
    instructionId: string;
    submittedEventId: string | null;
  }>;
  listDocumentLinks(documentId: string): Promise<CommercialTreasuryDocumentLink[]>;
  getPaymentOrderStatus(input: {
    documentId: string;
  }): Promise<{
    operationId: string | null;
    instructionId: string | null;
    operationStatus: string | null;
    instructionStatus: string | null;
    submittedEventId: string | null;
  } | null>;
}

export interface CommercialModuleDeps {
  documentRelations: CommercialDocumentRelationsPort;
  ledgerRead: CommercialLedgerReadPort;
  quoteSnapshot: CommercialQuoteSnapshotPort;
  quoteUsage: CommercialQuoteUsagePort;
  requisiteBindings: CommercialRequisiteBindingsPort;
  partyReferences: CommercialPartyReferencesPort;
  treasuryState: CommercialTreasuryStatePort;
}
