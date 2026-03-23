import {
  DOCUMENTS_IDEMPOTENCY_SCOPE,
  type DocumentsModule,
} from "@bedrock/documents";
import type { DocumentTransitionInput } from "@bedrock/documents/contracts";
import type { LedgerModule } from "@bedrock/ledger";
import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { Database, Transaction } from "@bedrock/platform/persistence";

type DocumentGetQuery = DocumentsModule["documents"]["queries"]["get"];
type DocumentPostingFinalizeSuccessCommand =
  DocumentsModule["posting"]["commands"]["finalizeSuccess"];

export interface DocumentPostingModulePorts {
  documents: {
    queries: Pick<DocumentsModule["documents"]["queries"], "get">;
  };
  posting: {
    commands: Pick<
      DocumentsModule["posting"]["commands"],
      | "finalizeSuccess"
      | "preparePost"
      | "prepareRepost"
      | "resolveIdempotencyKey"
    >;
  };
}

export type CreateDocumentPostingModule = (
  tx: Transaction,
) => DocumentPostingModulePorts;

export type DocumentPostingWorkflowInput = Omit<
  DocumentTransitionInput,
  "action"
>;

export interface DocumentPostingWorkflowDeps {
  db: Database;
  idempotency: IdempotencyPort;
  createLedgerModule(
    tx: Transaction,
  ): Pick<LedgerModule, "operations">;
  createDocumentsModule: CreateDocumentPostingModule;
}

export interface DocumentPostingWorkflow {
  post(
    input: DocumentPostingWorkflowInput,
  ): Promise<Awaited<ReturnType<DocumentPostingFinalizeSuccessCommand>>>;
  repost(
    input: DocumentPostingWorkflowInput,
  ): Promise<Awaited<ReturnType<DocumentPostingFinalizeSuccessCommand>>>;
}

export function createDocumentPostingWorkflow(
  deps: DocumentPostingWorkflowDeps,
): DocumentPostingWorkflow {
  return {
    async post(input: DocumentPostingWorkflowInput) {
      return deps.db.transaction(async (tx) => {
        const documentsModule = deps.createDocumentsModule(tx);
        const ledgerModule = deps.createLedgerModule(tx);
        const idempotencyKey =
          await documentsModule.posting.commands.resolveIdempotencyKey({
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
            (documentsModule.documents.queries.get as DocumentGetQuery)(
              input.docType,
              String(storedResult?.documentId ?? input.documentId),
              input.actorUserId,
            ),
          handler: async () => {
            const prepared = await documentsModule.posting.commands.preparePost({
              ...input,
              action: "post",
            });
            const ledgerResult = await ledgerModule.operations.commands.commit(
              prepared.resolved!.intent,
            );

            return documentsModule.posting.commands.finalizeSuccess({
              prepared,
              operationId: ledgerResult.operationId,
            });
          },
        });
      });
    },
    async repost(input: DocumentPostingWorkflowInput) {
      return deps.db.transaction(async (tx) => {
        const documentsModule = deps.createDocumentsModule(tx);
        const idempotencyKey =
          await documentsModule.posting.commands.resolveIdempotencyKey({
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
            (documentsModule.documents.queries.get as DocumentGetQuery)(
              input.docType,
              String(storedResult?.documentId ?? input.documentId),
              input.actorUserId,
            ),
          handler: async () => {
            const prepared =
              await documentsModule.posting.commands.prepareRepost({
              ...input,
              action: "repost",
            });

            return documentsModule.posting.commands.finalizeSuccess({
              prepared,
              operationId: prepared.postingOperationId!,
            });
          },
        });
      });
    },
  };
}
