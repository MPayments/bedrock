export const DEAL_EXECUTION_REQUEST_SCOPE = "workflow-deal-execution.request";
export const DEAL_EXECUTION_CREATE_LEG_OPERATION_SCOPE =
  "workflow-deal-execution.create-leg-operation";
export const DEAL_EXECUTION_RESOLVE_BLOCKER_SCOPE =
  "workflow-deal-execution.resolve-blocker";
export const DEAL_EXECUTION_CLOSE_SCOPE = "workflow-deal-execution.close";
export const DEAL_EXECUTION_PREPARE_INSTRUCTION_SCOPE =
  "workflow-deal-execution.prepare-instruction";
export const DEAL_EXECUTION_SUBMIT_INSTRUCTION_SCOPE =
  "workflow-deal-execution.submit-instruction";
export const DEAL_EXECUTION_RETRY_INSTRUCTION_SCOPE =
  "workflow-deal-execution.retry-instruction";
export const DEAL_EXECUTION_VOID_INSTRUCTION_SCOPE =
  "workflow-deal-execution.void-instruction";
export const DEAL_EXECUTION_REQUEST_RETURN_SCOPE =
  "workflow-deal-execution.request-return";
export const DEAL_EXECUTION_RECORD_OUTCOME_SCOPE =
  "workflow-deal-execution.record-outcome";
export const TREASURY_INSTRUCTION_OUTCOMES_RECONCILIATION_SOURCE =
  "treasury_instruction_outcomes";

export const EXECUTION_REQUESTABLE_STATUSES = new Set([
  "awaiting_funds",
  "awaiting_payment",
  "closing_documents",
]);
