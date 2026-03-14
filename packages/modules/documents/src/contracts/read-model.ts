import type { Document, DocumentLinkType } from "../domain/types";

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

export interface DocumentsReadModel {
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
}
