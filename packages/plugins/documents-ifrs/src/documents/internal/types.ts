import type {
  DocumentSnapshot,
  DocumentModuleRuntime,
} from "@bedrock/plugin-documents-sdk";

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

export type TransferDependencyDocument = Pick<
  DocumentSnapshot,
  "id" | "docType" | "payload" | "occurredAt"
>;

export interface TreasuryFxQuotePort {
  createQuoteSnapshot(input: {
    runtime: IfrsDocumentRuntime;
    fromCurrency: string;
    toCurrency: string;
    fromAmountMinor: string;
    asOf: Date;
    idempotencyKey: string;
  }): Promise<Record<string, unknown>>;
  loadQuoteSnapshotById(input: {
    runtime: IfrsDocumentRuntime;
    quoteId: string;
  }): Promise<Record<string, unknown>>;
}

export interface QuoteUsagePort {
  markQuoteUsedForFxExecute(input: {
    runtime: IfrsDocumentRuntime;
    quoteId: string;
    fxExecuteDocumentId: string;
    at: Date;
  }): Promise<void>;
}

export interface IfrsTransferLookupPort {
  resolveTransferDependencyDocument(input: {
    runtime: IfrsDocumentRuntime;
    transferDocumentId: string;
  }): Promise<TransferDependencyDocument>;
  listPendingTransfers(input: {
    runtime: IfrsDocumentRuntime;
    transferDocumentId: string;
  }): Promise<PendingTransferRecord[]>;
}

export interface IfrsFxExecuteLookupPort {
  resolveFxExecuteDependencyDocument(input: {
    runtime: IfrsDocumentRuntime;
    fxExecuteDocumentId: string;
  }): Promise<TransferDependencyDocument>;
  listPendingTransfers(input: {
    runtime: IfrsDocumentRuntime;
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

export type IfrsDocumentRuntime = DocumentModuleRuntime;
export type IfrsDocumentDb = IfrsDocumentRuntime;
