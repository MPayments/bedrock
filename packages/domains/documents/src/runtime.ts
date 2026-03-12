import type { ListDocumentsQuery } from "./validation";
import type {
  DocumentDetails,
  DocumentRequestContext,
  DocumentTransitionAction,
  DocumentWithOperationId,
} from "./types";

export interface DocumentsService {
  list(
    input?: ListDocumentsQuery,
    actorUserId?: string,
  ): Promise<{
    data: DocumentWithOperationId[];
    total: number;
    limit: number;
    offset: number;
  }>;
  get(
    docType: string,
    documentId: string,
    actorUserId?: string,
  ): Promise<DocumentWithOperationId>;
  getDetails(
    docType: string,
    documentId: string,
    actorUserId: string,
  ): Promise<DocumentDetails>;
  createDraft(input: {
    docType: string;
    createIdempotencyKey: string;
    payload: unknown;
    actorUserId: string;
    requestContext?: DocumentRequestContext;
  }): Promise<DocumentWithOperationId>;
  updateDraft(input: {
    docType: string;
    documentId: string;
    payload: unknown;
    actorUserId: string;
    idempotencyKey: string;
    requestContext?: DocumentRequestContext;
  }): Promise<DocumentWithOperationId>;
  transition(input: {
    action: DocumentTransitionAction;
    docType: string;
    documentId: string;
    actorUserId: string;
    idempotencyKey?: string;
    requestContext?: DocumentRequestContext;
  }): Promise<DocumentWithOperationId>;
  validateAccountingSourceCoverage(input?: { bookId?: string }): Promise<{
    packChecksum: string;
    validatedSources: string[];
  }>;
  hasDocument(documentId: string): Promise<boolean>;
}

export { createDocumentRegistry } from "./create-document-registry";
export { DOCUMENTS_WORKER_DESCRIPTOR, createDocumentsWorker } from "./workers";
export { createDefaultDocumentActionPolicyService } from "./policy";
export {
  assertCounterpartyPeriodsOpen,
  closeCounterpartyPeriod,
  collectDocumentCounterpartyIds,
  getPreviousCalendarMonthRange,
  isCounterpartyPeriodClosed,
  reopenCounterpartyPeriod,
} from "./period-locks";
export type * from "./types";
