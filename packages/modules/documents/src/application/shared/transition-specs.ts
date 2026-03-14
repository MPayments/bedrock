import { InvalidStateError } from "@bedrock/shared/core/errors";

import {
  buildDefaultActionIdempotencyKey,
} from "./idempotency-key";
import { resolveDocumentAccountingSourceId } from "./module-resolution";
import { enforceDocumentPolicy } from "./policy";
import type {
  DocumentTransitionAction,
  DocumentTransitionInput,
} from "../../contracts/service";
import { collectDocumentOrganizationIds } from "../../domain/accounting-periods";
import { assertDocumentIsActive, buildDocumentEventState } from "../../domain/document-state";
import { DOCUMENTS_IDEMPOTENCY_SCOPE } from "../../domain/idempotency";
import { isDocumentActionAllowed } from "../../domain/state-machine";
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
  assertDocumentIsActive(context.document, "submitted");

  const canSubmit = isDocumentActionAllowed({
    action: "submit",
    document: context.document,
    module: {
      postingRequired: context.module.postingRequired,
      allowDirectPostFromDraft: context.module.allowDirectPostFromDraft,
    },
  });

  if (!canSubmit) {
    if (
      context.module.allowDirectPostFromDraft &&
      context.document.submissionStatus === "draft" &&
      context.document.lifecycleStatus === "active"
    ) {
      throw new InvalidStateError(
        "Submit action is disabled for this document type; use post",
      );
    }

    throw new InvalidStateError("Only draft documents can be submitted");
  }

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

  const before = buildDocumentEventState(context.document);
  const stored = await context.repository.updateDocument({
    documentId: context.document.id,
    docType: context.input.docType,
    patch: {
      submissionStatus: "submitted",
      submittedBy: context.input.actorUserId,
      submittedAt: new Date(),
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
  assertDocumentIsActive(context.document, `${mode}d`);

  if (
    !isDocumentActionAllowed({
      action: mode,
      document: context.document,
      module: {
        postingRequired: context.module.postingRequired,
        allowDirectPostFromDraft: context.module.allowDirectPostFromDraft,
      },
    })
  ) {
    throw new InvalidStateError("Document is not awaiting approval");
  }

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

  const before = buildDocumentEventState(context.document);
  const stored = await context.repository.updateDocument({
    documentId: context.document.id,
    docType: context.input.docType,
    patch:
      mode === "approve"
        ? {
            approvalStatus: "approved",
            approvedBy: context.input.actorUserId,
            approvedAt: new Date(),
          }
        : {
            approvalStatus: "rejected",
            rejectedBy: context.input.actorUserId,
            rejectedAt: new Date(),
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
  if (
    !isDocumentActionAllowed({
      action: "cancel",
      document: context.document,
      module: {
        postingRequired: context.module.postingRequired,
        allowDirectPostFromDraft: context.module.allowDirectPostFromDraft,
      },
    })
  ) {
    throw new InvalidStateError(
      "Only active documents in unposted or failed status can be cancelled",
    );
  }

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

  const before = buildDocumentEventState(context.document);
  const stored = await context.repository.updateDocument({
    documentId: context.document.id,
    docType: context.input.docType,
    patch: {
      lifecycleStatus: "cancelled",
      cancelledBy: context.input.actorUserId,
      cancelledAt: new Date(),
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

  if (
    !isDocumentActionAllowed({
      action: "repost",
      document: context.document,
      module: {
        postingRequired: context.module.postingRequired,
        allowDirectPostFromDraft: context.module.allowDirectPostFromDraft,
      },
    })
  ) {
    throw new InvalidStateError("Only failed documents can be reposted");
  }

  await assertOrganizationPeriodsOpenForDocument({
    context,
    document: context.document,
  });

  const operationId = await context.repository.findPostingOperationId({
    documentId: context.document.id,
  });
  if (!operationId) {
    throw new InvalidStateError(
      "Failed document does not have a posting operation to repost",
    );
  }

  await context.repository.resetPostingOperation({ operationId });

  const before = buildDocumentEventState(context.document);
  const stored = await context.repository.updateDocument({
    documentId: context.document.id,
    docType: context.input.docType,
    patch: {
      postingStatus: "posting",
      postingStartedAt: new Date(),
      postingError: null,
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
  assertDocumentIsActive(context.document, "posted");

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
    const submitted = await context.repository.updateDocument({
      documentId: postingDocument.id,
      docType: context.input.docType,
      patch: {
        submissionStatus: "submitted",
        submittedBy: context.input.actorUserId,
        submittedAt: new Date(),
      },
    });

    if (!submitted) {
      throw new InvalidStateError("Failed to submit document before posting");
    }

    events.push(
      buildTransitionEvent({
        eventType: "submit",
        before: beforeSubmit,
        after: buildDocumentEventState(submitted),
      }),
    );

    postingDocument = submitted;
  }

  if (
    !isDocumentActionAllowed({
      action: "post",
      document: postingDocument,
      module: {
        postingRequired: context.module.postingRequired,
        allowDirectPostFromDraft: context.module.allowDirectPostFromDraft,
      },
    })
  ) {
    if (
      !context.module.postingRequired ||
      postingDocument.postingStatus === "not_required"
    ) {
      throw new DocumentPostingNotRequiredError(
        context.document.id,
        context.document.docType,
      );
    }

    throw new InvalidStateError("Document is not ready for posting");
  }

  if (!context.module.buildPostingPlan) {
    throw new DocumentPostingNotRequiredError(
      context.document.id,
      context.document.docType,
    );
  }

  const existingOperationId = await context.repository.findPostingOperationId({
    documentId: postingDocument.id,
  });
  if (existingOperationId) {
    throw new InvalidStateError(
      "Document already has a posting operation",
    );
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
  await context.repository.insertDocumentOperation({
    documentId: postingDocument.id,
    operationId: ledgerResult.operationId,
    kind: "post",
  });

  const beforePost = buildDocumentEventState(postingDocument);
  const stored = await context.repository.updateDocument({
    documentId: postingDocument.id,
    docType: context.input.docType,
    patch: {
      postingStatus: "posting",
      postingStartedAt: new Date(),
      postingError: null,
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
