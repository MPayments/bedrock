import type { Document, DocumentModule } from "@bedrock/documents";

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

export interface IfrsModuleDeps {
  requisitesService: RequisitesService;
  transferLookup: IfrsTransferLookupPort;
}

export type IfrsDocumentDb = Parameters<DocumentModule["canPost"]>[0]["db"];
