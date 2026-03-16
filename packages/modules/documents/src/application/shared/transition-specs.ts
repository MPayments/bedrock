import { InvalidStateError } from "@bedrock/shared/core/errors";

import { buildDocumentEventState } from "./document-event-state";
import { DOCUMENTS_IDEMPOTENCY_SCOPE } from "./documents-idempotency";
import { buildDefaultActionIdempotencyKey } from "./idempotency-key";
import { resolveDocumentAccountingSourceId } from "./module-resolution";
import { enforceDocumentPolicy } from "./policy";
import type {
  DocumentTransitionAction,
  DocumentTransitionInput,
} from "../../contracts/commands";
import { DocumentAggregate } from "../../domain/document";
import { collectDocumentOrganizationIds } from "../../domain/document-period-scope";
import { DocumentPostingNotRequiredError } from "../../errors";
import type {
  DocumentTransitionEvent,
  DocumentTransitionExecutionContext,
  DocumentTransitionExecutionResult,
  DocumentTransitionSpecs,
} from "../commands/transition-runtime";

function buildActionIdempotencyKey(
  action: DocumentTransitionAction,
  input: DocumentTransitionInput,
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

function buildWorkflowConfig(context: DocumentTransitionExecutionContext) {
  return {
    postingRequired: context.module.postingRequired,
    allowDirectPostFromDraft: context.module.allowDirectPostFromDraft,
  };
}

async function assertOrganizationPeriodsOpenForDocument(input: {
  context: DocumentTransitionExecutionContext;
  document: DocumentTransitionExecutionContext["document"];
}) {
  const organizationIds = collectDocumentOrganizationIds({
    payload: input.document.payload,
  });

  await input.context.services.accountingPeriods.assertOrganizationPeriodsOpen({
    occurredAt: input.document.occurredAt,
    organizationIds,
    docType: input.context.input.docType,
  });
}

async function runSubmit(context: DocumentTransitionExecutionContext) {
  const before = buildDocumentEventState(context.document);
  const nextDocument = DocumentAggregate.fromSnapshot(context.document)
    .submit({
      actorUserId: context.input.actorUserId,
      now: context.services.now(),
      module: buildWorkflowConfig(context),
    })
    .toSnapshot();

  await assertOrganizationPeriodsOpenForDocument({
    context,
    document: context.document,
  });

  await context.module.canSubmit(context.moduleContext, context.document);
  await enforceDocumentPolicy({
    policy: context.services.policy,
    action: "submit",
    module: context.module,
    actorUserId: context.input.actorUserId,
    moduleContext: context.moduleContext,
    document: context.document,
    requestContext: context.input.requestContext,
  });

  const stored = await context.documentsCommand.updateDocument({
    documentId: context.document.id,
    docType: context.input.docType,
    patch: {
      submissionStatus: nextDocument.submissionStatus,
      submittedBy: nextDocument.submittedBy,
      submittedAt: nextDocument.submittedAt,
      updatedAt: nextDocument.updatedAt,
    },
  });

  if (!stored) {
    throw new InvalidStateError("Failed to submit document");
  }

  return {
    document: stored,
    postingOperationId: null,
    events: [
      buildTransitionEvent({
        eventType: "submit",
        before,
        after: buildDocumentEventState(stored),
      }),
    ],
  } satisfies DocumentTransitionExecutionResult;
}

async function runApproveOrReject(
  context: DocumentTransitionExecutionContext,
  mode: "approve" | "reject",
) {
  const before = buildDocumentEventState(context.document);
  const aggregate = DocumentAggregate.fromSnapshot(context.document);
  const nextDocument =
    mode === "approve"
      ? aggregate.approve({
          actorUserId: context.input.actorUserId,
          now: context.services.now(),
          module: buildWorkflowConfig(context),
        }).toSnapshot()
      : aggregate.reject({
          actorUserId: context.input.actorUserId,
          now: context.services.now(),
          module: buildWorkflowConfig(context),
        }).toSnapshot();

  if (mode === "approve") {
    await context.module.canApprove(context.moduleContext, context.document);
  } else {
    await context.module.canReject(context.moduleContext, context.document);
  }

  await enforceDocumentPolicy({
    policy: context.services.policy,
    action: mode,
    module: context.module,
    actorUserId: context.input.actorUserId,
    moduleContext: context.moduleContext,
    document: context.document,
    requestContext: context.input.requestContext,
  });

  const stored = await context.documentsCommand.updateDocument({
    documentId: context.document.id,
    docType: context.input.docType,
    patch:
      mode === "approve"
        ? {
            approvalStatus: nextDocument.approvalStatus,
            approvedBy: nextDocument.approvedBy,
            approvedAt: nextDocument.approvedAt,
            updatedAt: nextDocument.updatedAt,
          }
        : {
            approvalStatus: nextDocument.approvalStatus,
            rejectedBy: nextDocument.rejectedBy,
            rejectedAt: nextDocument.rejectedAt,
            updatedAt: nextDocument.updatedAt,
          },
  });

  if (!stored) {
    throw new InvalidStateError(
      mode === "approve"
        ? "Failed to approve document"
        : "Failed to reject document",
    );
  }

  return {
    document: stored,
    postingOperationId: null,
    events: [
      buildTransitionEvent({
        eventType: mode,
        before,
        after: buildDocumentEventState(stored),
      }),
    ],
  } satisfies DocumentTransitionExecutionResult;
}

async function runCancel(context: DocumentTransitionExecutionContext) {
  const before = buildDocumentEventState(context.document);
  const nextDocument = DocumentAggregate.fromSnapshot(context.document)
    .cancel({
      actorUserId: context.input.actorUserId,
      now: context.services.now(),
      module: buildWorkflowConfig(context),
    })
    .toSnapshot();

  await assertOrganizationPeriodsOpenForDocument({
    context,
    document: context.document,
  });

  await context.module.canCancel(context.moduleContext, context.document);
  await enforceDocumentPolicy({
    policy: context.services.policy,
    action: "cancel",
    module: context.module,
    actorUserId: context.input.actorUserId,
    moduleContext: context.moduleContext,
    document: context.document,
    requestContext: context.input.requestContext,
  });

  const stored = await context.documentsCommand.updateDocument({
    documentId: context.document.id,
    docType: context.input.docType,
    patch: {
      lifecycleStatus: nextDocument.lifecycleStatus,
      cancelledBy: nextDocument.cancelledBy,
      cancelledAt: nextDocument.cancelledAt,
      updatedAt: nextDocument.updatedAt,
    },
  });

  if (!stored) {
    throw new InvalidStateError("Failed to cancel document");
  }

  return {
    document: stored,
    postingOperationId: null,
    events: [
      buildTransitionEvent({
        eventType: "cancel",
        before,
        after: buildDocumentEventState(stored),
      }),
    ],
  } satisfies DocumentTransitionExecutionResult;
}

async function runRepost(context: DocumentTransitionExecutionContext) {
  context.services.log.debug("documents repost requested", {
    documentId: context.input.documentId,
    docType: context.input.docType,
  });

  await assertOrganizationPeriodsOpenForDocument({
    context,
    document: context.document,
  });

  const operationId = await context.documentOperations.findPostingOperationId({
    documentId: context.document.id,
  });
  if (!operationId) {
    throw new InvalidStateError(
      "Failed document does not have a posting operation to repost",
    );
  }

  await context.documentOperations.resetPostingOperation({ operationId });

  const before = buildDocumentEventState(context.document);
  const nextDocument = DocumentAggregate.fromSnapshot(context.document)
    .resetForRepost({
      now: context.services.now(),
    })
    .toSnapshot();

  const stored = await context.documentsCommand.updateDocument({
    documentId: context.document.id,
    docType: context.input.docType,
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
    document: stored,
    postingOperationId: operationId,
    events: [
      buildTransitionEvent({
        eventType: "repost",
        before,
        after: buildDocumentEventState(stored),
        reasonMeta: {
          operationId,
        },
      }),
    ],
  } satisfies DocumentTransitionExecutionResult;
}

async function runPost(context: DocumentTransitionExecutionContext) {
  const events: DocumentTransitionEvent[] = [];
  let postingDocument = context.document;

  if (
    context.module.allowDirectPostFromDraft &&
    postingDocument.submissionStatus === "draft"
  ) {
    await context.module.canSubmit(context.moduleContext, postingDocument);
    await enforceDocumentPolicy({
      policy: context.services.policy,
      action: "submit",
      module: context.module,
      actorUserId: context.input.actorUserId,
      moduleContext: context.moduleContext,
      document: postingDocument,
      requestContext: context.input.requestContext,
    });

    const beforeSubmit = buildDocumentEventState(postingDocument);
    const submitted = DocumentAggregate.fromSnapshot(postingDocument)
      .submit({
        actorUserId: context.input.actorUserId,
        now: context.services.now(),
        module: {
          postingRequired: context.module.postingRequired,
          allowDirectPostFromDraft: false,
        },
      })
      .toSnapshot();

    const storedSubmitted = await context.documentsCommand.updateDocument({
      documentId: postingDocument.id,
      docType: context.input.docType,
      patch: {
        submissionStatus: submitted.submissionStatus,
        submittedBy: submitted.submittedBy,
        submittedAt: submitted.submittedAt,
        updatedAt: submitted.updatedAt,
      },
    });

    if (!storedSubmitted) {
      throw new InvalidStateError("Failed to submit document before posting");
    }

    events.push(
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
      actorUserId: context.input.actorUserId,
      now: context.services.now(),
      module: {
        postingRequired: context.module.postingRequired,
        allowDirectPostFromDraft: false,
      },
    })
    .document
    .toSnapshot();

  if (!context.module.buildPostingPlan) {
    throw new DocumentPostingNotRequiredError(
      context.document.id,
      context.document.docType,
    );
  }

  const existingOperationId = await context.documentOperations.findPostingOperationId({
    documentId: postingDocument.id,
  });
  if (existingOperationId) {
    throw new InvalidStateError("Document already has a posting operation");
  }

  await assertOrganizationPeriodsOpenForDocument({
    context,
    document: postingDocument,
  });

  await context.module.canPost(context.moduleContext, postingDocument);
  await enforceDocumentPolicy({
    policy: context.services.policy,
    action: "post",
    module: context.module,
    actorUserId: context.input.actorUserId,
    moduleContext: context.moduleContext,
    document: postingDocument,
    requestContext: context.input.requestContext,
  });

  const postingPlan = await context.module.buildPostingPlan(
    context.moduleContext,
    postingDocument,
  );

  const accountingSourceId = await resolveDocumentAccountingSourceId({
    module: context.module,
    moduleContext: context.moduleContext,
    document: postingDocument,
    postingPlan,
  });

  const resolved = await context.services.accounting.resolvePostingPlan({
    accountingSourceId,
    source: {
      type: `documents/${postingDocument.docType}/post`,
      id: postingDocument.id,
    },
    idempotencyKey: context.module.buildPostIdempotencyKey(postingDocument),
    postingDate: postingDocument.occurredAt,
    bookIdContext: postingPlan.requests[0]?.bookRefs.bookId,
    plan: postingPlan,
  });

  const ledgerResult = await context.ledger.commit(resolved.intent);
  await context.documentOperations.insertDocumentOperation({
    documentId: postingDocument.id,
    operationId: ledgerResult.operationId,
    kind: "post",
  });

  const beforePost = buildDocumentEventState(postingDocument);

  const stored = await context.documentsCommand.updateDocument({
    documentId: postingDocument.id,
    docType: context.input.docType,
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

  events.push(
    buildTransitionEvent({
      eventType: "post",
      before: beforePost,
      after: buildDocumentEventState(stored),
      reasonMeta: {
        operationId: ledgerResult.operationId,
        packChecksum: resolved.packChecksum,
        postingPlanChecksum: resolved.postingPlanChecksum,
        journalIntentChecksum: resolved.journalIntentChecksum,
        postingPlan,
        journalIntent: resolved.intent,
        resolvedTemplates: resolved.appliedTemplates,
      },
    }),
  );

  return {
    document: stored,
    postingOperationId: ledgerResult.operationId,
    events,
  } satisfies DocumentTransitionExecutionResult;
}

export const DOCUMENT_TRANSITION_SPECS: DocumentTransitionSpecs = {
  submit: {
    scope: DOCUMENTS_IDEMPOTENCY_SCOPE.SUBMIT,
    resolveIdempotencyKey: ({ transition }) =>
      transition.idempotencyKey ?? buildActionIdempotencyKey("submit", transition),
    execute: runSubmit,
  },
  approve: {
    scope: DOCUMENTS_IDEMPOTENCY_SCOPE.APPROVE,
    resolveIdempotencyKey: ({ transition }) =>
      transition.idempotencyKey ?? buildActionIdempotencyKey("approve", transition),
    execute: async (context) => runApproveOrReject(context, "approve"),
  },
  reject: {
    scope: DOCUMENTS_IDEMPOTENCY_SCOPE.REJECT,
    resolveIdempotencyKey: ({ transition }) =>
      transition.idempotencyKey ?? buildActionIdempotencyKey("reject", transition),
    execute: async (context) => runApproveOrReject(context, "reject"),
  },
  post: {
    scope: DOCUMENTS_IDEMPOTENCY_SCOPE.POST,
    needsDocumentForIdempotencyKey: true,
    resolveIdempotencyKey: ({ transition, context }) =>
      transition.idempotencyKey ??
      context?.module.buildPostIdempotencyKey(context.document) ??
      buildActionIdempotencyKey("post", transition),
    execute: runPost,
  },
  cancel: {
    scope: DOCUMENTS_IDEMPOTENCY_SCOPE.CANCEL,
    resolveIdempotencyKey: ({ transition }) =>
      transition.idempotencyKey ?? buildActionIdempotencyKey("cancel", transition),
    execute: runCancel,
  },
  repost: {
    scope: DOCUMENTS_IDEMPOTENCY_SCOPE.REPOST,
    resolveIdempotencyKey: ({ transition }) =>
      transition.idempotencyKey ?? buildActionIdempotencyKey("repost", transition),
    execute: runRepost,
  },
};
