import type { Document, DocumentModule } from "@bedrock/plugin-documents-sdk";

export interface OrganizationRequisiteBinding {
  requisiteId: string;
  bookId: string;
  organizationId: string;
  currencyCode: string;
  postingAccountNo: string;
  bookAccountInstanceId: string;
}

export interface RequisitesService {
  resolveBindings(input: {
    requisiteIds: string[];
  }): Promise<OrganizationRequisiteBinding[]>;
  findById(id: string): Promise<{
    id: string;
    ownerType: "organization" | "counterparty";
    ownerId: string;
  }>;
}

export interface PendingTransferRecord {
  transferId: bigint;
  pendingRef: string | null;
  amountMinor: bigint;
}

export interface TransferDependencyDocument
  extends Pick<Document, "id" | "docType" | "payload" | "occurredAt"> {}

export interface TreasuryFxQuotePort {
  createQuoteSnapshot(input: {
    db: IfrsDocumentDb;
    fromCurrency: string;
    toCurrency: string;
    fromAmountMinor: string;
    asOf: Date;
    idempotencyKey: string;
  }): Promise<Record<string, unknown>>;
  loadQuoteSnapshotById(input: {
    db: IfrsDocumentDb;
    quoteId: string;
  }): Promise<Record<string, unknown>>;
}

export interface QuoteUsagePort {
  markQuoteUsedForFxExecute(input: {
    db: IfrsDocumentDb;
    quoteId: string;
    fxExecuteDocumentId: string;
    at: Date;
  }): Promise<void>;
}

export interface IfrsTransferLookupPort {
  resolveTransferDependencyDocument(input: {
    db: IfrsDocumentDb;
    transferDocumentId: string;
  }): Promise<TransferDependencyDocument>;
  listPendingTransfers(input: {
    db: IfrsDocumentDb;
    transferDocumentId: string;
  }): Promise<PendingTransferRecord[]>;
}

export interface IfrsFxExecuteLookupPort {
  resolveFxExecuteDependencyDocument(input: {
    db: IfrsDocumentDb;
    fxExecuteDocumentId: string;
  }): Promise<TransferDependencyDocument>;
  listPendingTransfers(input: {
    db: IfrsDocumentDb;
    fxExecuteDocumentId: string;
  }): Promise<PendingTransferRecord[]>;
}

export interface IfrsModuleDeps {
  requisitesService: RequisitesService;
  transferLookup: IfrsTransferLookupPort;
  fxExecuteLookup: IfrsFxExecuteLookupPort;
  treasuryFxQuote: TreasuryFxQuotePort;
  quoteUsage: QuoteUsagePort;
}

export type IfrsDocumentDb = Parameters<DocumentModule["canPost"]>[0]["db"];
