import { and, eq, sql } from "drizzle-orm";

import { schema } from "@bedrock/core/documents/schema";
import { IDEMPOTENCY_SCOPE } from "@bedrock/core/idempotency";
import { InvalidStateError } from "@bedrock/kernel/errors";

import { DocumentPostingNotRequiredError } from "../errors";
import type { DocumentsServiceContext } from "../internal/context";
import {
  assertDocumentIsActive,
  buildDocumentWithOperationId,
  buildDocumentEventState,
  createModuleContext,
  getPostingOperationId,
  insertDocumentEvent,
  lockDocument,
  resolveDocumentAccountingSourceId,
  loadDocumentWithOperationId,
  resolveModuleForDocument,
} from "../internal/helpers";
import {
  enforceDocumentPolicy,
  persistDocumentPolicyDenial,
} from "../internal/policy";
import {
  assertCounterpartyPeriodsOpen,
  collectDocumentCounterpartyIds,
} from "../period-locks";
import { isDocumentActionAllowed } from "../state-machine";
import type { DocumentRequestContext, DocumentWithOperationId } from "../types";

export function createPostHandler(context: DocumentsServiceContext) {
  const { accounting, db, idempotency, ledger, log, policy, registry } = context;

  return async function post(input: {
    docType: string;
    documentId: string;
    actorUserId: string;
    idempotencyKey?: string;
    requestContext?: DocumentRequestContext;
  }): Promise<DocumentWithOperationId> {
    try {
      return await db.transaction(async (tx) => {
      const moduleContext = createModuleContext({
        db: tx,
        actorUserId: input.actorUserId,
        now: new Date(),
        log,
      });
      const document = await lockDocument(tx, input.documentId, input.docType);
      const module = resolveModuleForDocument(registry, document);
      assertDocumentIsActive(document, "posted");
      const postIdempotencyKey =
        input.idempotencyKey ?? module.buildPostIdempotencyKey(document);

      return idempotency.withIdempotencyTx({
        tx,
        scope: IDEMPOTENCY_SCOPE.DOCUMENTS_POST,
        idempotencyKey: postIdempotencyKey,
        request: {
          docType: input.docType,
          documentId: input.documentId,
          actorUserId: input.actorUserId,
          postIdempotencyKey,
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
            registry,
          ),
        handler: async () => {
          const existingOperationId = await getPostingOperationId(tx, document.id);
          if (existingOperationId) {
            return buildDocumentWithOperationId({
              registry,
              document,
              postingOperationId: existingOperationId,
            });
          }

          let postingDocument = document;

          if (
            module.allowDirectPostFromDraft &&
            postingDocument.submissionStatus === "draft"
          ) {
            await module.canSubmit(moduleContext, postingDocument);
            await enforceDocumentPolicy({
              policy,
              action: "submit",
              module,
              actorUserId: input.actorUserId,
              moduleContext,
              document: postingDocument,
              requestContext: input.requestContext,
            });

            const beforeSubmit = buildDocumentEventState(postingDocument);
            const [submitted] = await tx
              .update(schema.documents)
              .set({
                submissionStatus: "submitted",
                submittedBy: input.actorUserId,
                submittedAt: sql`now()`,
                updatedAt: sql`now()`,
                version: sql`${schema.documents.version} + 1`,
              })
              .where(
                and(
                  eq(schema.documents.id, postingDocument.id),
                  eq(schema.documents.docType, input.docType),
                ),
              )
              .returning();

            if (!submitted) {
              throw new InvalidStateError("Failed to submit document before posting");
            }

            await insertDocumentEvent(tx, {
              documentId: postingDocument.id,
              eventType: "submit",
              actorId: input.actorUserId,
              requestId: input.requestContext?.requestId,
              correlationId: input.requestContext?.correlationId,
              traceId: input.requestContext?.traceId,
              causationId: input.requestContext?.causationId,
              before: beforeSubmit,
              after: buildDocumentEventState(submitted),
            });

            postingDocument = submitted;
          }

          if (
            !isDocumentActionAllowed({
              action: "post",
              document: postingDocument,
              module: {
                postingRequired: module.postingRequired,
                allowDirectPostFromDraft: module.allowDirectPostFromDraft,
              },
            })
          ) {
            if (
              !module.postingRequired ||
              postingDocument.postingStatus === "not_required"
            ) {
              throw new DocumentPostingNotRequiredError(document.id, document.docType);
            }
            throw new InvalidStateError("Document is not ready for posting");
          }
          if (!module.buildPostingPlan) {
            throw new DocumentPostingNotRequiredError(document.id, document.docType);
          }
          const counterpartyIds = collectDocumentCounterpartyIds({
            documentCounterpartyId: postingDocument.counterpartyId,
            payload: postingDocument.payload,
          });
          await assertCounterpartyPeriodsOpen({
            db: tx,
            occurredAt: postingDocument.occurredAt,
            counterpartyIds,
            docType: input.docType,
          });

          await module.canPost(moduleContext, postingDocument);
          await enforceDocumentPolicy({
            policy,
            action: "post",
            module,
            actorUserId: input.actorUserId,
            moduleContext,
            document: postingDocument,
            requestContext: input.requestContext,
          });

          const postingPlan = await module.buildPostingPlan(
            moduleContext,
            postingDocument,
          );
          const accountingSourceId = await resolveDocumentAccountingSourceId({
            module,
            moduleContext,
            document: postingDocument,
            postingPlan,
          });
          const resolved = await accounting.resolvePostingPlan({
            accountingSourceId,
            source: {
              type: `documents/${postingDocument.docType}/post`,
              id: postingDocument.id,
            },
            idempotencyKey: module.buildPostIdempotencyKey(postingDocument),
            postingDate: postingDocument.occurredAt,
            bookIdContext: postingPlan.requests[0]?.bookRefs.bookId,
            plan: postingPlan,
          });
          const result = await ledger.commit(tx, resolved.intent);

          await tx
            .insert(schema.documentOperations)
            .values({
              documentId: postingDocument.id,
              operationId: result.operationId,
              kind: "post",
            })
            .onConflictDoNothing();

          const before = buildDocumentEventState(postingDocument);
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
            documentId: postingDocument.id,
            eventType: "post",
            actorId: input.actorUserId,
            requestId: input.requestContext?.requestId,
            correlationId: input.requestContext?.correlationId,
            traceId: input.requestContext?.traceId,
            causationId: input.requestContext?.causationId,
            before,
            after: buildDocumentEventState(stored!),
            reasonMeta: {
              operationId: result.operationId,
              packChecksum: resolved.packChecksum,
              postingPlanChecksum: resolved.postingPlanChecksum,
              journalIntentChecksum: resolved.journalIntentChecksum,
              postingPlan,
              journalIntent: resolved.intent,
              resolvedTemplates: resolved.appliedTemplates,
            },
          });

          return buildDocumentWithOperationId({
            registry,
            document: stored!,
            postingOperationId: result.operationId,
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
