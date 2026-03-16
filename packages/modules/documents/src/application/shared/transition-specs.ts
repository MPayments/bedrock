import { InvalidStateError } from "@bedrock/shared/core/errors";

import { buildDocumentEventState } from "./document-event-state";
import { DOCUMENTS_IDEMPOTENCY_SCOPE } from "./documents-idempotency";
import { buildDefaultActionIdempotencyKey } from "./idempotency-key";
import { enforceDocumentPolicy } from "./policy";
import type {
  DocumentTransitionAction,
  DocumentTransitionInput,
} from "../../contracts/commands";
import { DocumentAggregate } from "../../domain/document";
import { collectDocumentOrganizationIds } from "../../domain/document-period-scope";
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
  cancel: {
    scope: DOCUMENTS_IDEMPOTENCY_SCOPE.CANCEL,
    resolveIdempotencyKey: ({ transition }) =>
      transition.idempotencyKey ?? buildActionIdempotencyKey("cancel", transition),
    execute: runCancel,
  },
};
