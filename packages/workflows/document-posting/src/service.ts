import {
  DOCUMENTS_IDEMPOTENCY_SCOPE,
  type DocumentsIdempotencyPort,
  type DocumentsService,
} from "@bedrock/documents";
import type { DocumentTransitionInput } from "@bedrock/documents/contracts";
import type { LedgerCommitService } from "@bedrock/ledger";
import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { Database, Transaction } from "@bedrock/platform/persistence";

export type CreateDocumentPostingService = (
  tx: Transaction,
  idempotency: DocumentsIdempotencyPort,
) => Pick<DocumentsService, "get" | "posting">;

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

function createDocumentsIdempotencyPort(input: {
  tx: Transaction;
  idempotency: IdempotencyPort;
}): DocumentsIdempotencyPort {
  return {
    withIdempotency<TResult, TStoredResult = Record<string, unknown>>(params: {
      scope: string;
      idempotencyKey: string;
      request: unknown;
      actorId?: string | null;
      handler: () => Promise<TResult>;
      serializeResult: (result: TResult) => TStoredResult;
      loadReplayResult: (params: {
        storedResult: TStoredResult | null;
      }) => Promise<TResult>;
      serializeError?: (error: unknown) => Record<string, unknown>;
    }) {
      return input.idempotency.withIdempotencyTx<TResult, TStoredResult>({
        tx: input.tx,
        scope: params.scope,
        idempotencyKey: params.idempotencyKey,
        request: params.request,
        actorId: params.actorId,
        handler: params.handler,
        serializeResult: params.serializeResult,
        loadReplayResult: ({ storedResult }) =>
          params.loadReplayResult({
            storedResult: (storedResult as TStoredResult | null) ?? null,
          }),
        serializeError: params.serializeError,
      });
    },
  };
}

export function createDocumentPostingWorkflow(
  deps: DocumentPostingWorkflowDeps,
) {
  return {
    async post(input: DocumentPostingWorkflowInput) {
      return deps.db.transaction(async (tx) => {
        const documents = deps.createDocumentsService(
          tx,
          createDocumentsIdempotencyPort({
            tx,
            idempotency: deps.idempotency,
          }),
        );
        const idempotencyKey = await documents.posting.resolveIdempotencyKey({
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
            const prepared = await documents.posting.preparePost({
              ...input,
              action: "post",
            });
            const ledgerResult = await deps.ledgerCommit.commit(
              tx,
              prepared.resolved!.intent,
            );

            return documents.posting.finalizeSuccess({
              prepared,
              operationId: ledgerResult.operationId,
            });
          },
        });
      });
    },
    async repost(input: DocumentPostingWorkflowInput) {
      return deps.db.transaction(async (tx) => {
        const documents = deps.createDocumentsService(
          tx,
          createDocumentsIdempotencyPort({
            tx,
            idempotency: deps.idempotency,
          }),
        );
        const idempotencyKey = await documents.posting.resolveIdempotencyKey({
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
            const prepared = await documents.posting.prepareRepost({
              ...input,
              action: "repost",
            });

            return documents.posting.finalizeSuccess({
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
