import { and, eq, sql } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";
import { IDEMPOTENCY_SCOPE } from "@bedrock/idempotency";
import { InvalidStateError } from "@bedrock/kernel/errors";

import { DocumentPostingNotRequiredError } from "../errors";
import type { DocumentsServiceContext } from "../internal/context";
import {
  assertDocumentIsActive,
  buildDocumentEventState,
  createModuleContext,
  getPostingOperationId,
  insertDocumentEvent,
  lockDocument,
  resolveDocumentAccountingSourceId,
  loadDocumentWithOperationId,
  resolveModule,
} from "../internal/helpers";
import {
  enforceDocumentPolicy,
  persistDocumentPolicyDenial,
} from "../internal/policy";
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
    const module = resolveModule(registry, input.docType);

    try {
      return await db.transaction(async (tx) => {
      const moduleContext = createModuleContext({
        db: tx,
        actorUserId: input.actorUserId,
        now: new Date(),
        log,
      });
      const document = await lockDocument(tx, input.documentId, input.docType);
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
          ),
        handler: async () => {
          const existingOperationId = await getPostingOperationId(tx, document.id);
          if (existingOperationId) {
            return {
              document,
              postingOperationId: existingOperationId,
            };
          }

          if (!module.postingRequired || document.postingStatus === "not_required") {
            throw new DocumentPostingNotRequiredError(document.id, document.docType);
          }
          if (document.submissionStatus !== "submitted") {
            throw new InvalidStateError("Document must be submitted before posting");
          }
          if (
            document.approvalStatus !== "approved" &&
            document.approvalStatus !== "not_required"
          ) {
            throw new InvalidStateError("Document must be approved before posting");
          }
          if (document.postingStatus !== "unposted") {
            throw new InvalidStateError("Document is not ready for posting");
          }
          if (!module.buildPostingPlan) {
            throw new DocumentPostingNotRequiredError(document.id, document.docType);
          }

          await module.canPost(moduleContext, document);
          await enforceDocumentPolicy({
            policy,
            action: "post",
            module,
            actorUserId: input.actorUserId,
            moduleContext,
            document,
            requestContext: input.requestContext,
          });

          const postingPlan = await module.buildPostingPlan(
            moduleContext,
            document,
          );
          const accountingSourceId = await resolveDocumentAccountingSourceId({
            module,
            moduleContext,
            document,
            postingPlan,
          });
          const resolved = await accounting.resolvePostingPlan({
            accountingSourceId,
            source: {
              type: `documents/${document.docType}/post`,
              id: document.id,
            },
            idempotencyKey: module.buildPostIdempotencyKey(document),
            postingDate: document.occurredAt,
            bookIdContext: postingPlan.requests[0]?.bookRefs.bookId,
            plan: postingPlan,
          });
          const result = await ledger.commit(tx, resolved.intent);

          await tx
            .insert(schema.documentOperations)
            .values({
              documentId: document.id,
              operationId: result.operationId,
              kind: "post",
            })
            .onConflictDoNothing();

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

          return {
            document: stored!,
            postingOperationId: result.operationId,
          };
        },
      });
      });
    } catch (error) {
      await persistDocumentPolicyDenial(db, error);
      throw error;
    }
  };
}
