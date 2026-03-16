import { InvalidStateError } from "@bedrock/shared/core/errors";

import type {
  DocumentRequestContext,
  DocumentTransitionAction,
  DocumentTransitionInput,
} from "../../contracts/commands";
import type { DocumentWithOperationId } from "../../contracts/dto";
import { DocumentAggregate, type Document } from "../../domain/document";
import { collectDocumentOrganizationIds } from "../../domain/document-period-scope";
import { DocumentPostingNotRequiredError } from "../../errors";
import type { DocumentTransitionEvent } from "../commands/transition-runtime";
import { buildDocumentWithOperationId, loadDocumentOrThrow } from "../shared/actions";
import type { DocumentsServiceContext } from "../shared/context";
import { buildDocumentEventState } from "../shared/document-event-state";
import { buildDefaultActionIdempotencyKey } from "../shared/idempotency-key";
import {
  createModuleContext,
  resolveDocumentAccountingSourceId,
  resolveModuleForDocument,
} from "../shared/module-resolution";
import { enforceDocumentPolicy } from "../shared/policy";

type PostingPreparationResolution = Awaited<
  ReturnType<DocumentsServiceContext["accounting"]["resolvePostingPlan"]>
>;

export interface ResolveDocumentPostingIdempotencyKeyInput {
  action: "post" | "repost";
  docType: string;
  documentId: string;
  actorUserId: string;
  idempotencyKey?: string;
}

export interface PreparedDocumentPosting {
  action: "post" | "repost";
  docType: string;
  document: Document;
  actorUserId: string;
  requestContext?: DocumentRequestContext;
  postingOperationId: string | null;
  successEvents: DocumentTransitionEvent[];
  finalEvent: {
    eventType: "post" | "repost";
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    reasonMeta?: Record<string, unknown> | null;
  };
  resolved?: PostingPreparationResolution;
}

export interface FinalizePreparedDocumentPostingInput {
  prepared: PreparedDocumentPosting;
  operationId: string;
}

export interface FinalizeFailedDocumentPostingInput {
  prepared: PreparedDocumentPosting;
  error: string;
  operationId?: string | null;
}

function buildActionIdempotencyKey(
  action: DocumentTransitionAction,
  input: {
    docType: string;
    documentId: string;
    actorUserId: string;
  },
) {
  return buildDefaultActionIdempotencyKey(`documents.${action}`, {
    docType: input.docType,
    documentId: input.documentId,
    actorUserId: input.actorUserId,
  });
}

function buildTransitionEvent(input: {
  eventType: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reasonMeta?: Record<string, unknown> | null;
}): DocumentTransitionEvent {
  return {
    eventType: input.eventType,
    before: input.before,
    after: input.after,
    reasonMeta: input.reasonMeta,
  };
}

function buildWorkflowConfig(context: {
  postingRequired: boolean;
  allowDirectPostFromDraft: boolean;
}) {
  return {
    postingRequired: context.postingRequired,
    allowDirectPostFromDraft: context.allowDirectPostFromDraft,
  };
}

async function assertOrganizationPeriodsOpenForDocument(input: {
  context: DocumentsServiceContext;
  document: Document;
  docType: string;
}) {
  const organizationIds = collectDocumentOrganizationIds({
    payload: input.document.payload,
  });

  await input.context.accountingPeriods.assertOrganizationPeriodsOpen({
    occurredAt: input.document.occurredAt,
    organizationIds,
    docType: input.docType,
  });
}

async function insertPreparedDocumentEvents(input: {
  context: DocumentsServiceContext;
  events: DocumentTransitionEvent[];
  documentId: string;
  actorUserId: string;
  requestContext?: DocumentRequestContext;
}) {
  for (const event of input.events) {
    await input.context.documentEvents.insertDocumentEvent({
      documentId: input.documentId,
      eventType: event.eventType,
      actorId: input.actorUserId,
      requestId: input.requestContext?.requestId,
      correlationId: input.requestContext?.correlationId,
      traceId: input.requestContext?.traceId,
      causationId: input.requestContext?.causationId,
      before: event.before,
      after: event.after,
      reasonMeta: event.reasonMeta ?? null,
    });
  }
}

export function createResolveDocumentPostingIdempotencyKeyHandler(
  context: DocumentsServiceContext,
) {
  return async function resolvePostingIdempotencyKey(
    input: ResolveDocumentPostingIdempotencyKeyInput,
  ): Promise<string> {
    if (input.idempotencyKey) {
      return input.idempotencyKey;
    }

    if (input.action === "repost") {
      return buildActionIdempotencyKey("repost", input);
    }

    return context.transactions.withTransaction(async ({ documentsCommand }) => {
      const document = await loadDocumentOrThrow(documentsCommand, {
        documentId: input.documentId,
        docType: input.docType,
        forUpdate: true,
      });
      const module = resolveModuleForDocument(context.registry, document);

      return (
        module.buildPostIdempotencyKey?.(document) ??
        buildActionIdempotencyKey("post", input)
      );
    });
  };
}

export function createPrepareDocumentPostHandler(
  context: DocumentsServiceContext,
) {
  return async function preparePost(
    input: DocumentTransitionInput,
  ): Promise<PreparedDocumentPosting> {
    return context.transactions.withTransaction(
      async ({ documentsCommand, documentOperations, moduleRuntime }) => {
        const document = await loadDocumentOrThrow(documentsCommand, {
          documentId: input.documentId,
          docType: input.docType,
          forUpdate: true,
        });
        const module = resolveModuleForDocument(context.registry, document);
        const moduleContext = createModuleContext({
          actorUserId: input.actorUserId,
          now: context.now(),
          log: context.log,
          operationIdempotencyKey: null,
          runtime: moduleRuntime,
        });

        const successEvents: DocumentTransitionEvent[] = [];
        let postingDocument = document;

        if (
          module.allowDirectPostFromDraft &&
          postingDocument.submissionStatus === "draft"
        ) {
          await module.canSubmit(moduleContext, postingDocument);
          await enforceDocumentPolicy({
            policy: context.policy,
            action: "submit",
            module,
            actorUserId: input.actorUserId,
            moduleContext,
            document: postingDocument,
            requestContext: input.requestContext,
          });

          const beforeSubmit = buildDocumentEventState(postingDocument);
          const submitted = DocumentAggregate.fromSnapshot(postingDocument)
            .submit({
              actorUserId: input.actorUserId,
              now: context.now(),
              module: {
                postingRequired: module.postingRequired,
                allowDirectPostFromDraft: false,
              },
            })
            .toSnapshot();

          const storedSubmitted = await documentsCommand.updateDocument({
            documentId: postingDocument.id,
            docType: input.docType,
            patch: {
              submissionStatus: submitted.submissionStatus,
              submittedBy: submitted.submittedBy,
              submittedAt: submitted.submittedAt,
              updatedAt: submitted.updatedAt,
            },
          });

          if (!storedSubmitted) {
            throw new InvalidStateError(
              "Failed to submit document before posting",
            );
          }

          successEvents.push(
            buildTransitionEvent({
              eventType: "submit",
              before: beforeSubmit,
              after: buildDocumentEventState(storedSubmitted),
            }),
          );

          postingDocument = storedSubmitted;
        }

        const startedPosting = DocumentAggregate.fromSnapshot(postingDocument)
          .startPosting({
            actorUserId: input.actorUserId,
            now: context.now(),
            module: {
              postingRequired: module.postingRequired,
              allowDirectPostFromDraft: false,
            },
          })
          .document.toSnapshot();

        if (!module.buildPostingPlan) {
          throw new DocumentPostingNotRequiredError(
            document.id,
            document.docType,
          );
        }

        const existingOperationId =
          await documentOperations.findPostingOperationId({
            documentId: postingDocument.id,
          });
        if (existingOperationId) {
          throw new InvalidStateError("Document already has a posting operation");
        }

        await assertOrganizationPeriodsOpenForDocument({
          context,
          document: postingDocument,
          docType: input.docType,
        });

        await module.canPost(moduleContext, postingDocument);
        await enforceDocumentPolicy({
          policy: context.policy,
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

        const resolved = await context.accounting.resolvePostingPlan({
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

        const beforePost = buildDocumentEventState(postingDocument);

        const stored = await documentsCommand.updateDocument({
          documentId: postingDocument.id,
          docType: input.docType,
          patch: {
            postingStatus: startedPosting.postingStatus,
            postingStartedAt: startedPosting.postingStartedAt,
            postingError: startedPosting.postingError,
            updatedAt: startedPosting.updatedAt,
          },
        });

        if (!stored) {
          throw new InvalidStateError("Failed to mark document as posting");
        }

        return {
          action: "post",
          docType: input.docType,
          document: stored,
          actorUserId: input.actorUserId,
          requestContext: input.requestContext,
          postingOperationId: null,
          successEvents,
          finalEvent: {
            eventType: "post",
            before: beforePost,
            after: buildDocumentEventState(stored),
            reasonMeta: {
              packChecksum: resolved.packChecksum,
              postingPlanChecksum: resolved.postingPlanChecksum,
              journalIntentChecksum: resolved.journalIntentChecksum,
              postingPlan,
              journalIntent: resolved.intent,
              resolvedTemplates: resolved.appliedTemplates,
            },
          },
          resolved,
        };
      },
    );
  };
}

export function createPrepareDocumentRepostHandler(
  context: DocumentsServiceContext,
) {
  return async function prepareRepost(
    input: DocumentTransitionInput,
  ): Promise<PreparedDocumentPosting> {
    return context.transactions.withTransaction(
      async ({ documentsCommand, documentOperations }) => {
        context.log.debug("documents repost requested", {
          documentId: input.documentId,
          docType: input.docType,
        });

        const document = await loadDocumentOrThrow(documentsCommand, {
          documentId: input.documentId,
          docType: input.docType,
          forUpdate: true,
        });

        await assertOrganizationPeriodsOpenForDocument({
          context,
          document,
          docType: input.docType,
        });

        const operationId = await documentOperations.findPostingOperationId({
          documentId: document.id,
        });
        if (!operationId) {
          throw new InvalidStateError(
            "Failed document does not have a posting operation to repost",
          );
        }

        await documentOperations.resetPostingOperation({ operationId });

        const before = buildDocumentEventState(document);
        const nextDocument = DocumentAggregate.fromSnapshot(document)
          .resetForRepost({
            now: context.now(),
          })
          .toSnapshot();

        const stored = await documentsCommand.updateDocument({
          documentId: document.id,
          docType: input.docType,
          patch: {
            postingStatus: nextDocument.postingStatus,
            postingStartedAt: nextDocument.postingStartedAt,
            postingError: nextDocument.postingError,
            updatedAt: nextDocument.updatedAt,
          },
        });

        if (!stored) {
          throw new InvalidStateError("Failed to repost document");
        }

        return {
          action: "repost",
          docType: input.docType,
          document: stored,
          actorUserId: input.actorUserId,
          requestContext: input.requestContext,
          postingOperationId: operationId,
          successEvents: [],
          finalEvent: {
            eventType: "repost",
            before,
            after: buildDocumentEventState(stored),
          },
        };
      },
    );
  };
}

export function createFinalizeDocumentPostingSuccessHandler(
  context: DocumentsServiceContext,
) {
  return async function finalizeSuccess(
    input: FinalizePreparedDocumentPostingInput,
  ): Promise<DocumentWithOperationId> {
    return context.transactions.withTransaction(
      async ({ documentOperations }) => {
        await documentOperations.insertDocumentOperation({
          documentId: input.prepared.document.id,
          operationId: input.operationId,
          kind: "post",
        });

        await insertPreparedDocumentEvents({
          context,
          events: input.prepared.successEvents,
          documentId: input.prepared.document.id,
          actorUserId: input.prepared.actorUserId,
          requestContext: input.prepared.requestContext,
        });

        await insertPreparedDocumentEvents({
          context,
          events: [
            buildTransitionEvent({
              eventType: input.prepared.finalEvent.eventType,
              before: input.prepared.finalEvent.before,
              after: input.prepared.finalEvent.after,
              reasonMeta: {
                operationId: input.operationId,
                ...(input.prepared.finalEvent.reasonMeta ?? {}),
              },
            }),
          ],
          documentId: input.prepared.document.id,
          actorUserId: input.prepared.actorUserId,
          requestContext: input.prepared.requestContext,
        });

        return buildDocumentWithOperationId({
          registry: context.registry,
          document: input.prepared.document,
          postingOperationId: input.operationId,
        });
      },
    );
  };
}

export function createFinalizeDocumentPostingFailureHandler(
  context: DocumentsServiceContext,
) {
  return async function finalizeFailure(
    input: FinalizeFailedDocumentPostingInput,
  ): Promise<DocumentWithOperationId> {
    return context.transactions.withTransaction(async ({ documentsCommand }) => {
      const failed = DocumentAggregate.fromSnapshot(input.prepared.document)
        .completePosting({
          status: "failed",
          now: context.now(),
          error: input.error,
        })
        .toSnapshot();

      const stored = await documentsCommand.updateDocument({
        documentId: input.prepared.document.id,
        docType: input.prepared.docType,
        patch: {
          postingStatus: failed.postingStatus,
          postedAt: failed.postedAt,
          postingError: failed.postingError,
          updatedAt: failed.updatedAt,
        },
      });

      if (!stored) {
        throw new InvalidStateError("Failed to mark document posting as failed");
      }

      await insertPreparedDocumentEvents({
        context,
        events: input.prepared.successEvents,
        documentId: stored.id,
        actorUserId: input.prepared.actorUserId,
        requestContext: input.prepared.requestContext,
      });

      await insertPreparedDocumentEvents({
        context,
        events: [
          buildTransitionEvent({
            eventType: "posting_failed",
            before: buildDocumentEventState(input.prepared.document),
            after: buildDocumentEventState(stored),
            reasonMeta: {
              error: input.error,
              ...(input.operationId ? { operationId: input.operationId } : {}),
            },
          }),
        ],
        documentId: stored.id,
        actorUserId: input.prepared.actorUserId,
        requestContext: input.prepared.requestContext,
      });

      return buildDocumentWithOperationId({
        registry: context.registry,
        document: stored,
        postingOperationId: input.operationId ?? null,
      });
    });
  };
}
