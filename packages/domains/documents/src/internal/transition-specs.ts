import { and, eq, sql } from "drizzle-orm";

import { InvalidStateError } from "@multihansa/common/errors";
import { schema } from "@multihansa/documents/schema";

import { DocumentPostingNotRequiredError } from "../errors";
import { IDEMPOTENCY_SCOPE } from "../scopes";
import {
  assertDocumentIsActive,
  buildDefaultActionIdempotencyKey,
  buildDocumentEventState,
  getPostingOperationId,
  resolveDocumentAccountingSourceId,
} from "./helpers";
import { enforceDocumentPolicy } from "./policy";
import type {
  DocumentTransitionEvent,
  DocumentTransitionExecutionContext,
  DocumentTransitionExecutionResult,
  DocumentTransitionSpecs,
} from "../commands/transition-runtime";
import {
  assertCounterpartyPeriodsOpen,
  collectDocumentCounterpartyIds,
} from "../period-locks";
import { isDocumentActionAllowed } from "../state-machine";
import type {
  DocumentTransitionAction,
  DocumentTransitionInput,
} from "../types";

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

async function assertCounterpartyPeriodsOpenForDocument(input: {
  context: DocumentTransitionExecutionContext;
  document: DocumentTransitionExecutionContext["document"];
}) {
  const counterpartyIds = collectDocumentCounterpartyIds({
    documentCounterpartyId: input.document.counterpartyId,
    payload: input.document.payload,
  });

  await assertCounterpartyPeriodsOpen({
    db: input.context.tx,
    occurredAt: input.document.occurredAt,
    counterpartyIds,
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

  await assertCounterpartyPeriodsOpenForDocument({
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
  const [stored] = await context.tx
    .update(schema.documents)
    .set({
      submissionStatus: "submitted",
      submittedBy: context.input.actorUserId,
      submittedAt: sql`now()`,
      updatedAt: sql`now()`,
      version: sql`${schema.documents.version} + 1`,
    })
    .where(
      and(
        eq(schema.documents.id, context.document.id),
        eq(schema.documents.docType, context.input.docType),
      ),
    )
    .returning();

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
  const [stored] = await context.tx
    .update(schema.documents)
    .set(
      mode === "approve"
        ? {
            approvalStatus: "approved",
            approvedBy: context.input.actorUserId,
            approvedAt: sql`now()`,
            updatedAt: sql`now()`,
            version: sql`${schema.documents.version} + 1`,
          }
        : {
            approvalStatus: "rejected",
            rejectedBy: context.input.actorUserId,
            rejectedAt: sql`now()`,
            updatedAt: sql`now()`,
            version: sql`${schema.documents.version} + 1`,
          },
    )
    .where(
      and(
        eq(schema.documents.id, context.document.id),
        eq(schema.documents.docType, context.input.docType),
      ),
    )
    .returning();

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

  await assertCounterpartyPeriodsOpenForDocument({
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
  const [stored] = await context.tx
    .update(schema.documents)
    .set({
      lifecycleStatus: "cancelled",
      cancelledBy: context.input.actorUserId,
      cancelledAt: sql`now()`,
      updatedAt: sql`now()`,
      version: sql`${schema.documents.version} + 1`,
    })
    .where(
      and(
        eq(schema.documents.id, context.document.id),
        eq(schema.documents.docType, context.input.docType),
      ),
    )
    .returning();

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

  await assertCounterpartyPeriodsOpenForDocument({
    context,
    document: context.document,
  });

  const operationId = await getPostingOperationId(context.tx, context.document.id);
  if (!operationId) {
    throw new InvalidStateError(
      "Failed document does not have a posting operation to repost",
    );
  }

  await context.tx
    .update(schema.ledgerOperations)
    .set({
      status: "pending",
      error: null,
      postedAt: null,
    })
    .where(eq(schema.ledgerOperations.id, operationId));

  await context.tx
    .update(schema.tbTransferPlans)
    .set({
      status: "pending",
      error: null,
    })
    .where(eq(schema.tbTransferPlans.operationId, operationId));

  await context.tx
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

  const before = buildDocumentEventState(context.document);
  const [stored] = await context.tx
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
        eq(schema.documents.id, context.document.id),
        eq(schema.documents.docType, context.input.docType),
      ),
    )
    .returning();

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
    const [submitted] = await context.tx
      .update(schema.documents)
      .set({
        submissionStatus: "submitted",
        submittedBy: context.input.actorUserId,
        submittedAt: sql`now()`,
        updatedAt: sql`now()`,
        version: sql`${schema.documents.version} + 1`,
      })
      .where(
        and(
          eq(schema.documents.id, postingDocument.id),
          eq(schema.documents.docType, context.input.docType),
        ),
      )
      .returning();

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

  const existingOperationId = await getPostingOperationId(
    context.tx,
    postingDocument.id,
  );
  if (existingOperationId) {
    throw new InvalidStateError(
      "Document already has a posting operation",
    );
  }

  await assertCounterpartyPeriodsOpenForDocument({
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

  const ledgerResult = await context.services.ledger.commit(
    context.tx,
    resolved.intent,
  );

  await context.tx
    .insert(schema.documentOperations)
    .values({
      documentId: postingDocument.id,
      operationId: ledgerResult.operationId,
      kind: "post",
    })
    .onConflictDoNothing();

  const beforePost = buildDocumentEventState(postingDocument);
  const [stored] = await context.tx
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
        eq(schema.documents.id, postingDocument.id),
        eq(schema.documents.docType, context.input.docType),
      ),
    )
    .returning();

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
    scope: IDEMPOTENCY_SCOPE.DOCUMENTS_SUBMIT,
    resolveIdempotencyKey: ({ transition }) =>
      transition.idempotencyKey ?? buildActionIdempotencyKey("submit", transition),
    execute: runSubmit,
  },
  approve: {
    scope: IDEMPOTENCY_SCOPE.DOCUMENTS_APPROVE,
    resolveIdempotencyKey: ({ transition }) =>
      transition.idempotencyKey ?? buildActionIdempotencyKey("approve", transition),
    execute: async (context) => runApproveOrReject(context, "approve"),
  },
  reject: {
    scope: IDEMPOTENCY_SCOPE.DOCUMENTS_REJECT,
    resolveIdempotencyKey: ({ transition }) =>
      transition.idempotencyKey ?? buildActionIdempotencyKey("reject", transition),
    execute: async (context) => runApproveOrReject(context, "reject"),
  },
  post: {
    scope: IDEMPOTENCY_SCOPE.DOCUMENTS_POST,
    needsDocumentForIdempotencyKey: true,
    resolveIdempotencyKey: ({ transition, context }) =>
      transition.idempotencyKey ??
      context?.module.buildPostIdempotencyKey(context.document) ??
      buildActionIdempotencyKey("post", transition),
    execute: runPost,
  },
  cancel: {
    scope: IDEMPOTENCY_SCOPE.DOCUMENTS_CANCEL,
    resolveIdempotencyKey: ({ transition }) =>
      transition.idempotencyKey ?? buildActionIdempotencyKey("cancel", transition),
    execute: runCancel,
  },
  repost: {
    scope: IDEMPOTENCY_SCOPE.DOCUMENTS_REPOST,
    resolveIdempotencyKey: ({ transition }) =>
      transition.idempotencyKey ?? buildActionIdempotencyKey("repost", transition),
    execute: runRepost,
  },
};
