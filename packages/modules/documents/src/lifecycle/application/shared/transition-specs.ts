import { InvalidStateError } from "@bedrock/shared/core/errors";

import { invokeDocumentModuleAction } from "./action-dispatch";
import { enforceDocumentPolicy } from "./policy";
import { Document } from "../../../documents/domain/document";
import {
  assertOrganizationPeriodsOpenForDocument,
  buildDocumentActionEvent,
  buildDocumentActionIdempotencyKey,
} from "../../../shared/application/action-runtime";
import { buildDocumentEventState } from "../../../shared/application/document-event-state";
import { DOCUMENTS_IDEMPOTENCY_SCOPE } from "../../../shared/application/documents-idempotency";
import type {
  DocumentTransitionExecutionContext,
  DocumentTransitionExecutionResult,
  DocumentTransitionSpecs,
} from "../commands/transition-runtime";

async function applyTransitionEffects(input: {
  context: DocumentTransitionExecutionContext;
  action: "submit" | "approve" | "reject" | "cancel";
  before: DocumentTransitionExecutionContext["document"];
  after: DocumentTransitionExecutionContext["document"];
}) {
  await input.context.services.transitionEffects.apply({
    action: input.action,
    before: input.before,
    after: input.after,
    module: input.context.module,
    moduleContext: input.context.moduleContext,
    services: {
      accountingPeriods: input.context.services.accountingPeriods,
    },
    transition: input.context.input,
    transaction: input.context.transaction,
  });
}

function buildWorkflowConfig(context: DocumentTransitionExecutionContext) {
  return {
    postingRequired: context.module.postingRequired,
    allowDirectPostFromDraft: context.module.allowDirectPostFromDraft,
  };
}

async function runSubmit(context: DocumentTransitionExecutionContext) {
  const before = buildDocumentEventState(context.document);
  const nextDocument = Document.fromSnapshot(context.document)
    .submit({
      actorUserId: context.input.actorUserId,
      now: context.services.runtime.now(),
      module: buildWorkflowConfig(context),
    })
    .toSnapshot();

  await assertOrganizationPeriodsOpenForDocument({
    accountingPeriods: context.services.accountingPeriods,
    document: context.document,
    docType: context.input.docType,
  });

  await invokeDocumentModuleAction({
    action: "submit",
    module: context.module,
    moduleContext: context.moduleContext,
    document: context.document,
  });
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

  await applyTransitionEffects({
    context,
    action: "submit",
    before: context.document,
    after: stored,
  });

  return {
    document: stored,
    postingOperationId: null,
    events: [
      buildDocumentActionEvent({
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
  const aggregate = Document.fromSnapshot(context.document);
  const nextDocument =
    mode === "approve"
      ? aggregate.approve({
          actorUserId: context.input.actorUserId,
          now: context.services.runtime.now(),
          module: buildWorkflowConfig(context),
        }).toSnapshot()
      : aggregate.reject({
          actorUserId: context.input.actorUserId,
          now: context.services.runtime.now(),
          module: buildWorkflowConfig(context),
        }).toSnapshot();

  await invokeDocumentModuleAction({
    action: mode,
    module: context.module,
    moduleContext: context.moduleContext,
    document: context.document,
  });

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

  await applyTransitionEffects({
    context,
    action: mode,
    before: context.document,
    after: stored,
  });

  return {
    document: stored,
    postingOperationId: null,
    events: [
      buildDocumentActionEvent({
        eventType: mode,
        before,
        after: buildDocumentEventState(stored),
      }),
    ],
  } satisfies DocumentTransitionExecutionResult;
}

async function runCancel(context: DocumentTransitionExecutionContext) {
  const before = buildDocumentEventState(context.document);
  const nextDocument = Document.fromSnapshot(context.document)
    .cancel({
      actorUserId: context.input.actorUserId,
      now: context.services.runtime.now(),
      module: buildWorkflowConfig(context),
    })
    .toSnapshot();

  await assertOrganizationPeriodsOpenForDocument({
    accountingPeriods: context.services.accountingPeriods,
    document: context.document,
    docType: context.input.docType,
  });

  await invokeDocumentModuleAction({
    action: "cancel",
    module: context.module,
    moduleContext: context.moduleContext,
    document: context.document,
  });
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

  await applyTransitionEffects({
    context,
    action: "cancel",
    before: context.document,
    after: stored,
  });

  return {
    document: stored,
    postingOperationId: null,
    events: [
      buildDocumentActionEvent({
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
      transition.idempotencyKey ??
      buildDocumentActionIdempotencyKey("submit", transition),
    execute: runSubmit,
  },
  approve: {
    scope: DOCUMENTS_IDEMPOTENCY_SCOPE.APPROVE,
    resolveIdempotencyKey: ({ transition }) =>
      transition.idempotencyKey ??
      buildDocumentActionIdempotencyKey("approve", transition),
    execute: async (context) => runApproveOrReject(context, "approve"),
  },
  reject: {
    scope: DOCUMENTS_IDEMPOTENCY_SCOPE.REJECT,
    resolveIdempotencyKey: ({ transition }) =>
      transition.idempotencyKey ??
      buildDocumentActionIdempotencyKey("reject", transition),
    execute: async (context) => runApproveOrReject(context, "reject"),
  },
  cancel: {
    scope: DOCUMENTS_IDEMPOTENCY_SCOPE.CANCEL,
    resolveIdempotencyKey: ({ transition }) =>
      transition.idempotencyKey ??
      buildDocumentActionIdempotencyKey("cancel", transition),
    execute: runCancel,
  },
};
