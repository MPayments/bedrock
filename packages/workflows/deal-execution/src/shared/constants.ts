export const DEAL_EXECUTION_REQUEST_SCOPE = "workflow-deal-execution.request";
export const DEAL_EXECUTION_CREATE_LEG_OPERATION_SCOPE =
  "workflow-deal-execution.create-leg-operation";
export const DEAL_EXECUTION_RESOLVE_BLOCKER_SCOPE =
  "workflow-deal-execution.resolve-blocker";
export const DEAL_EXECUTION_CLOSE_SCOPE = "workflow-deal-execution.close";

export const EXECUTION_REQUESTABLE_STATUSES = new Set([
  "awaiting_funds",
  "awaiting_payment",
  "closing_documents",
]);
