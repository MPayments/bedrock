import type {
  DocumentLinkType,
  DocumentSnapshot,
} from "./documents/domain/document";

export interface GetDocumentByTypeReadModelInput {
  documentId: string;
  docType: string;
  forUpdate?: boolean;
}

export interface FindIncomingLinkedDocumentInput {
  toDocumentId: string;
  linkType: DocumentLinkType;
  fromDocType: string;
}

export interface GetDocumentOperationIdReadModelInput {
  documentId: string;
  kind: string;
}

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

export interface FindDocumentIdByCreateIdempotencyKeyReadModelInput {
  docType: string;
  createIdempotencyKey: string;
}

export interface ListAdjustmentsForOrganizationPeriodInput {
  organizationId: string;
  periodStart: Date;
  periodEnd: Date;
  docTypes: string[];
}

export interface DocumentsReadModel {
  getDocumentByType: (
    input: GetDocumentByTypeReadModelInput,
  ) => Promise<DocumentSnapshot | null>;
  findIncomingLinkedDocument: (
    input: FindIncomingLinkedDocumentInput,
  ) => Promise<DocumentSnapshot | null>;
  getDocumentOperationId: (
    input: GetDocumentOperationIdReadModelInput,
  ) => Promise<string | null>;
  listDocumentLabelsById: (ids: string[]) => Promise<Map<string, string>>;
  hasDocumentsForCustomer: (
    customerId: string,
  ) => Promise<boolean>;
  findDocumentIdByCreateIdempotencyKey: (
    input: FindDocumentIdByCreateIdempotencyKeyReadModelInput,
  ) => Promise<string | null>;
  listOperationDocumentRefs: (
    operationIds: string[],
  ) => Promise<Map<string, DocumentOperationRef>>;
  listAdjustmentsForOrganizationPeriod: (
    input: ListAdjustmentsForOrganizationPeriodInput,
  ) => Promise<DocumentAdjustmentRow[]>;
  listAuditEventsByDocumentId: (
    documentIds: string[],
  ) => Promise<DocumentAuditEventRow[]>;
}
