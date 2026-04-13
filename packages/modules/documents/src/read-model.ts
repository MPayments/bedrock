import type { Document, DocumentLinkType } from "./domain/document";
import { createDrizzleDocumentsReadModel } from "./infra/drizzle/queries";

export interface DocumentOperationRef {
  operationId: string;
  documentId: string;
  documentType: string;
  channel: string | null;
}

export interface DocumentAdjustmentRow {
  documentId: string;
  docType: string;
  docNo: string;
  occurredAt: Date;
  title: string;
}

export interface DocumentAuditEventRow {
  id: string;
  eventType: string;
  actorId: string | null;
  createdAt: Date;
}

export interface DocumentBusinessLinkRow {
  documentId: string;
  dealId: string | null;
}

export interface DealTraceDocumentRow {
  documentId: string;
  dealId: string | null;
  docType: string;
  occurredAt: Date;
  lifecycleStatus: string;
  submissionStatus: string;
  approvalStatus: string;
  postingStatus: string;
  ledgerOperationIds: string[];
}

export interface DocumentsReadModel {
  existsById: (documentId: string) => Promise<boolean>;
  getDocumentByType: (input: {
    documentId: string;
    docType: string;
    forUpdate?: boolean;
  }) => Promise<Document | null>;
  findIncomingLinkedDocument: (input: {
    toDocumentId: string;
    linkType: DocumentLinkType;
    fromDocType: string;
  }) => Promise<Document | null>;
  getDocumentOperationId: (input: {
    documentId: string;
    kind: string;
  }) => Promise<string | null>;
  listDocumentLabelsById: (ids: string[]) => Promise<Map<string, string>>;
  hasDocumentsForCustomer: (
    customerId: string,
  ) => Promise<boolean>;
  findDocumentIdByCreateIdempotencyKey: (input: {
    docType: string;
    createIdempotencyKey: string;
  }) => Promise<string | null>;
  listOperationDocumentRefs: (
    operationIds: string[],
  ) => Promise<Map<string, DocumentOperationRef>>;
  listAdjustmentsForOrganizationPeriod: (input: {
    organizationId: string;
    periodStart: Date;
    periodEnd: Date;
    docTypes: string[];
  }) => Promise<DocumentAdjustmentRow[]>;
  listAuditEventsByDocumentId: (
    documentIds: string[],
  ) => Promise<DocumentAuditEventRow[]>;
  findBusinessLinkByDocumentId: (
    documentId: string,
  ) => Promise<DocumentBusinessLinkRow | null>;
  listDealTraceRowsByDealId: (
    dealId: string,
  ) => Promise<DealTraceDocumentRow[]>;
}

export { createDrizzleDocumentsReadModel };
