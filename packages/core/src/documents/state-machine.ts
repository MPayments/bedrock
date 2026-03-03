import type {
  Document,
  DocumentApprovalStatus,
  DocumentLifecycleStatus,
  DocumentPostingStatus,
  DocumentSubmissionStatus,
} from "./schema";

export const DOCUMENT_ACTIONS = [
  "edit",
  "submit",
  "approve",
  "reject",
  "post",
  "cancel",
  "repost",
] as const;

export type DocumentAction = (typeof DOCUMENT_ACTIONS)[number];

export interface DocumentWorkflowState {
  submissionStatus: DocumentSubmissionStatus;
  approvalStatus: DocumentApprovalStatus;
  postingStatus: DocumentPostingStatus;
  lifecycleStatus: DocumentLifecycleStatus;
}

export interface DocumentModuleWorkflowConfig {
  postingRequired: boolean;
  allowDirectPostFromDraft?: boolean;
}

function canEdit(state: DocumentWorkflowState) {
  return (
    state.lifecycleStatus === "active" &&
    state.submissionStatus === "draft"
  );
}

function canSubmit(
  state: DocumentWorkflowState,
  module: DocumentModuleWorkflowConfig,
) {
  return (
    state.lifecycleStatus === "active" &&
    state.submissionStatus === "draft" &&
    !module.allowDirectPostFromDraft
  );
}

function canApproveOrReject(state: DocumentWorkflowState) {
  return (
    state.lifecycleStatus === "active" &&
    state.submissionStatus === "submitted" &&
    state.approvalStatus === "pending"
  );
}

function canPost(
  state: DocumentWorkflowState,
  module: DocumentModuleWorkflowConfig,
) {
  if (state.lifecycleStatus !== "active") {
    return false;
  }
  if (!module.postingRequired || state.postingStatus === "not_required") {
    return false;
  }
  if (state.postingStatus !== "unposted") {
    return false;
  }
  if (state.submissionStatus === "draft") {
    return module.allowDirectPostFromDraft === true;
  }
  if (state.submissionStatus !== "submitted") {
    return false;
  }
  return (
    state.approvalStatus === "approved" ||
    state.approvalStatus === "not_required"
  );
}

function canCancel(state: DocumentWorkflowState) {
  return (
    state.lifecycleStatus === "active" &&
    (state.postingStatus === "unposted" || state.postingStatus === "failed")
  );
}

function canRepost(state: DocumentWorkflowState) {
  return (
    state.lifecycleStatus === "active" && state.postingStatus === "failed"
  );
}

export function resolveDocumentAllowedActions(input: {
  document: Pick<
    Document,
    | "submissionStatus"
    | "approvalStatus"
    | "postingStatus"
    | "lifecycleStatus"
  >;
  module: DocumentModuleWorkflowConfig;
}): DocumentAction[] {
  const state: DocumentWorkflowState = {
    submissionStatus: input.document.submissionStatus,
    approvalStatus: input.document.approvalStatus,
    postingStatus: input.document.postingStatus,
    lifecycleStatus: input.document.lifecycleStatus,
  };
  const module = input.module;
  const actions: DocumentAction[] = [];

  if (canEdit(state)) {
    actions.push("edit");
  }
  if (canSubmit(state, module)) {
    actions.push("submit");
  }
  if (canApproveOrReject(state)) {
    actions.push("approve", "reject");
  }
  if (canPost(state, module)) {
    actions.push("post");
  }
  if (canCancel(state)) {
    actions.push("cancel");
  }
  if (canRepost(state)) {
    actions.push("repost");
  }

  return actions;
}

export function isDocumentActionAllowed(input: {
  action: DocumentAction;
  document: Pick<
    Document,
    | "submissionStatus"
    | "approvalStatus"
    | "postingStatus"
    | "lifecycleStatus"
  >;
  module: DocumentModuleWorkflowConfig;
}) {
  return resolveDocumentAllowedActions({
    document: input.document,
    module: input.module,
  }).includes(input.action);
}
