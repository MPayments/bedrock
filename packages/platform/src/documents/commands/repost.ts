import { and, eq, sql } from "drizzle-orm";

import { InvalidStateError } from "@bedrock/foundation/kernel/errors";
import { schema } from "@bedrock/platform/documents/schema";
import { IDEMPOTENCY_SCOPE } from "@bedrock/platform/idempotency";

import type { DocumentsServiceContext } from "../internal/context";
import {
  buildDefaultActionIdempotencyKey,
  buildDocumentEventState,
  getPostingOperationId,
  insertDocumentEvent,
  loadDocumentWithOperationId,
  lockDocument,
  resolveModule,
} from "../internal/helpers";
import type { DocumentRequestContext, DocumentWithOperationId } from "../types";

export function createRepostHandler(context: DocumentsServiceContext) {
  const { db, idempotency, log, registry } = context;

  return async function repost(input: {
    docType: string;
    documentId: string;
    actorUserId: string;
    idempotencyKey?: string;
    requestContext?: DocumentRequestContext;
  }): Promise<DocumentWithOperationId> {
    resolveModule(registry, input.docType);
    const idempotencyKey =
      input.idempotencyKey ??
      buildDefaultActionIdempotencyKey("documents.repost", {
        docType: input.docType,
        documentId: input.documentId,
        actorUserId: input.actorUserId,
      });

    return db.transaction(async (tx) => {
      log.debug("documents repost requested", {
        documentId: input.documentId,
        docType: input.docType,
      });

      return idempotency.withIdempotencyTx({
        tx,
        scope: IDEMPOTENCY_SCOPE.DOCUMENTS_REPOST,
        idempotencyKey,
        request: {
          docType: input.docType,
          documentId: input.documentId,
          actorUserId: input.actorUserId,
        },
        actorId: input.actorUserId,
        serializeResult: (result: DocumentWithOperationId) => ({
          documentId: result.document.id,
          postingOperationId: result.postingOperationId,
        }),
        loadReplayResult: async ({
          storedResult,
        }: {
          storedResult:
            | { documentId?: string; postingOperationId?: string | null }
            | null;
        }) =>
          loadDocumentWithOperationId(
            tx,
            input.docType,
            String(storedResult?.documentId ?? input.documentId),
            typeof storedResult?.postingOperationId === "string"
              ? storedResult.postingOperationId
              : null,
          ),
        handler: async () => {
          const document = await lockDocument(tx, input.documentId, input.docType);
          if (document.lifecycleStatus !== "active") {
            throw new InvalidStateError("Only active documents can be reposted");
          }
          if (document.postingStatus !== "failed") {
            throw new InvalidStateError("Only failed documents can be reposted");
          }

          const operationId = await getPostingOperationId(tx, document.id);
          if (!operationId) {
            throw new InvalidStateError(
              "Failed document does not have a posting operation to repost",
            );
          }

          await tx
            .update(schema.ledgerOperations)
            .set({
              status: "pending",
              error: null,
              postedAt: null,
            })
            .where(eq(schema.ledgerOperations.id, operationId));

          await tx
            .update(schema.tbTransferPlans)
            .set({
              status: "pending",
              error: null,
            })
            .where(eq(schema.tbTransferPlans.operationId, operationId));

          await tx
            .update(schema.outbox)
            .set({
              status: "pending",
              error: null,
              lockedAt: null,
              availableAt: sql`now()`,
            })
            .where(
              and(
                eq(schema.outbox.kind, "post_operation"),
                eq(schema.outbox.refId, operationId),
              ),
            );

          const before = buildDocumentEventState(document);
          const [stored] = await tx
            .update(schema.documents)
            .set({
              postingStatus: "posting",
              postingStartedAt: sql`now()`,
              postingError: null,
              updatedAt: sql`now()`,
              version: sql`${schema.documents.version} + 1`,
            })
            .where(
              and(
                eq(schema.documents.id, document.id),
                eq(schema.documents.docType, input.docType),
              ),
            )
            .returning();

          await insertDocumentEvent(tx, {
            documentId: document.id,
            eventType: "repost",
            actorId: input.actorUserId,
            requestId: input.requestContext?.requestId,
            correlationId: input.requestContext?.correlationId,
            traceId: input.requestContext?.traceId,
            causationId: input.requestContext?.causationId,
            before,
            after: buildDocumentEventState(stored!),
            reasonMeta: {
              operationId,
            },
          });

          return {
            document: stored!,
            postingOperationId: operationId,
          };
        },
      });
    });
  };
}
