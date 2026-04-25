import type { DealWorkflowProjection } from "@bedrock/deals/contracts";

export function isExecutionRequestAllowed(workflow: DealWorkflowProjection) {
  if (
    workflow.summary.status === "awaiting_funds" ||
    workflow.summary.status === "awaiting_payment" ||
    workflow.summary.status === "closing_documents"
  ) {
    return true;
  }

  const readiness = workflow.transitionReadiness.find(
    (item) => item.targetStatus === "awaiting_funds",
  );

  return readiness?.allowed ?? false;
}
