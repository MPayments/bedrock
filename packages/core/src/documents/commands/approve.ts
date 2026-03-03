import { and, eq, sql } from "drizzle-orm";

import { InvalidStateError } from "@bedrock/kernel/errors";
import { schema } from "@bedrock/core/documents/schema";
import { IDEMPOTENCY_SCOPE } from "@bedrock/core/idempotency";

import type { DocumentsServiceContext } from "../internal/context";
import {
  assertDocumentIsActive,
  buildDocumentWithOperationId,
  buildDefaultActionIdempotencyKey,
  buildDocumentEventState,
  createModuleContext,
  insertDocumentEvent,
  lockDocument,
  loadDocumentWithOperationId,
  resolveModuleForDocument,
} from "../internal/helpers";
import {
  enforceDocumentPolicy,
  persistDocumentPolicyDenial,
} from "../internal/policy";
import { isDocumentActionAllowed } from "../state-machine";
import type { DocumentRequestContext, DocumentWithOperationId } from "../types";

export function createApproveHandler(context: DocumentsServiceContext) {
  const { db, idempotency, log, policy, registry } = context;

  return async function approve(input: {
    docType: string;
    documentId: string;
    actorUserId: string;
    idempotencyKey?: string;
    requestContext?: DocumentRequestContext;
  }): Promise<DocumentWithOperationId> {
    const idempotencyKey =
      input.idempotencyKey ??
      buildDefaultActionIdempotencyKey("documents.approve", {
        docType: input.docType,
        documentId: input.documentId,
        actorUserId: input.actorUserId,
      });

    try {
      return await db.transaction(async (tx) => {
      const moduleContext = createModuleContext({
        db: tx,
        actorUserId: input.actorUserId,
        now: new Date(),
        log,
      });

      return idempotency.withIdempotencyTx({
        tx,
        scope: IDEMPOTENCY_SCOPE.DOCUMENTS_APPROVE,
        idempotencyKey,
        request: {
          docType: input.docType,
          documentId: input.documentId,
          actorUserId: input.actorUserId,
        },
        actorId: input.actorUserId,
        serializeResult: (result: DocumentWithOperationId) => ({
          documentId: result.document.id,
        }),
        loadReplayResult: async ({
          storedResult,
        }: {
          storedResult: { documentId?: string } | null;
        }) =>
          loadDocumentWithOperationId(
            tx,
            input.docType,
            String(storedResult?.documentId ?? input.documentId),
            null,
            registry,
          ),
        handler: async () => {
          const document = await lockDocument(tx, input.documentId, input.docType);
          const module = resolveModuleForDocument(registry, document);
          assertDocumentIsActive(document, "approved");

          if (
            !isDocumentActionAllowed({
              action: "approve",
              document,
              module: {
                postingRequired: module.postingRequired,
                allowDirectPostFromDraft: module.allowDirectPostFromDraft,
              },
            })
          ) {
            throw new InvalidStateError("Document is not awaiting approval");
          }

          await module.canApprove(moduleContext, document);
          await enforceDocumentPolicy({
            policy,
            action: "approve",
            module,
            actorUserId: input.actorUserId,
            moduleContext,
            document,
            requestContext: input.requestContext,
          });

          const before = buildDocumentEventState(document);
          const [stored] = await tx
            .update(schema.documents)
            .set({
              approvalStatus: "approved",
              approvedBy: input.actorUserId,
              approvedAt: sql`now()`,
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
            eventType: "approve",
            actorId: input.actorUserId,
            requestId: input.requestContext?.requestId,
            correlationId: input.requestContext?.correlationId,
            traceId: input.requestContext?.traceId,
            causationId: input.requestContext?.causationId,
            before,
            after: buildDocumentEventState(stored!),
          });

          return buildDocumentWithOperationId({
            registry,
            document: stored!,
            postingOperationId: null,
          });
        },
      });
      });
    } catch (error) {
      await persistDocumentPolicyDenial(db, error);
      throw error;
    }
  };
}
