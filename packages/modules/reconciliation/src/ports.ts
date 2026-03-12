import type { DocumentWithOperationId } from "@bedrock/documents";
import type { IdempotencyPort } from "@bedrock/idempotency";
import type { CorrelationContext } from "@bedrock/common";

export interface ReconciliationDocumentsPort {
  createDraft(input: {
    docType: string;
    createIdempotencyKey: string;
    payload: unknown;
    actorUserId: string;
    requestContext?: CorrelationContext;
  }): Promise<DocumentWithOperationId>;
  existsById(documentId: string): Promise<boolean>;
}

export interface ReconciliationLedgerLookupPort {
  operationExists(operationId: string): Promise<boolean>;
}

export type ReconciliationIdempotencyPort = IdempotencyPort;
