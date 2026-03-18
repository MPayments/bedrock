import {
  DOCUMENTS_IDEMPOTENCY_SCOPE,
  type DocumentsService,
} from "@bedrock/documents";
import type { DocumentTransitionInput } from "@bedrock/documents/contracts";
import type { LedgerCommitService } from "@bedrock/ledger";
import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { Database, Transaction } from "@bedrock/platform/persistence";

export type CreateDocumentPostingService = (
  tx: Transaction,
) => Pick<DocumentsService, "get" | "actions">;

export type DocumentPostingWorkflowInput = Omit<
  DocumentTransitionInput,
  "action"
>;

export interface DocumentPostingWorkflowDeps {
  db: Database;
  idempotency: IdempotencyPort;
  ledgerCommit: LedgerCommitService;
  createDocumentsService: CreateDocumentPostingService;
}

export function createDocumentPostingWorkflow(
  deps: DocumentPostingWorkflowDeps,
) {
  return {
    async post(input: DocumentPostingWorkflowInput) {
      return deps.db.transaction(async (tx) => {
        const documents = deps.createDocumentsService(tx);
        const idempotencyKey = await documents.actions.resolveIdempotencyKey({
          action: "post",
          docType: input.docType,
          documentId: input.documentId,
          actorUserId: input.actorUserId,
          idempotencyKey: input.idempotencyKey,
        });

        return deps.idempotency.withIdempotencyTx({
          tx,
          scope: DOCUMENTS_IDEMPOTENCY_SCOPE.POST,
          idempotencyKey,
          request: {
            action: "post",
            docType: input.docType,
            documentId: input.documentId,
            actorUserId: input.actorUserId,
            transitionIdempotencyKey: idempotencyKey,
          },
          actorId: input.actorUserId,
          serializeResult: (result) => ({
            documentId: result.document.id,
            postingOperationId: result.postingOperationId,
          }),
          loadReplayResult: async ({ storedResult }) =>
            documents.get(
              input.docType,
              String(storedResult?.documentId ?? input.documentId),
              input.actorUserId,
            ),
          handler: async () => {
            const prepared = await documents.actions.prepare({
              ...input,
              action: "post",
            });
            const ledgerResult = await deps.ledgerCommit.commit(
              tx,
              prepared.resolved!.intent,
            );

            return documents.actions.finalizeSuccess({
              prepared,
              operationId: ledgerResult.operationId,
            });
          },
        });
      });
    },
    async repost(input: DocumentPostingWorkflowInput) {
      return deps.db.transaction(async (tx) => {
        const documents = deps.createDocumentsService(tx);
        const idempotencyKey = await documents.actions.resolveIdempotencyKey({
          action: "repost",
          docType: input.docType,
          documentId: input.documentId,
          actorUserId: input.actorUserId,
          idempotencyKey: input.idempotencyKey,
        });

        return deps.idempotency.withIdempotencyTx({
          tx,
          scope: DOCUMENTS_IDEMPOTENCY_SCOPE.REPOST,
          idempotencyKey,
          request: {
            action: "repost",
            docType: input.docType,
            documentId: input.documentId,
            actorUserId: input.actorUserId,
            transitionIdempotencyKey: idempotencyKey,
          },
          actorId: input.actorUserId,
          serializeResult: (result) => ({
            documentId: result.document.id,
            postingOperationId: result.postingOperationId,
          }),
          loadReplayResult: async ({ storedResult }) =>
            documents.get(
              input.docType,
              String(storedResult?.documentId ?? input.documentId),
              input.actorUserId,
            ),
          handler: async () => {
            const prepared = await documents.actions.prepare({
              ...input,
              action: "repost",
            });

            return documents.actions.finalizeSuccess({
              prepared,
              operationId: prepared.postingOperationId!,
            });
          },
        });
      });
    },
  };
}

export type DocumentPostingWorkflow = ReturnType<
  typeof createDocumentPostingWorkflow
>;
