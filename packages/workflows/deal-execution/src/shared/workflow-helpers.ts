import {
  DealNotFoundError,
  DealTransitionBlockedError,
  type DealsModule,
} from "@bedrock/deals";
import type { DealWorkflowProjection } from "@bedrock/deals/contracts";

import { EXECUTION_REQUESTABLE_STATUSES } from "./constants";

export function assertExecutionRequestAllowed(workflow: DealWorkflowProjection) {
  if (EXECUTION_REQUESTABLE_STATUSES.has(workflow.summary.status)) {
    return;
  }

  const readiness = workflow.transitionReadiness.find(
    (item) => item.targetStatus === "awaiting_funds",
  );

  if (readiness?.allowed) {
    return;
  }

  throw new DealTransitionBlockedError(
    "awaiting_funds",
    readiness?.blockers ?? [],
  );
}

export function getCustomerId(workflow: DealWorkflowProjection) {
  return (
    workflow.participants.find(
      (participant) => participant.role === "customer",
    )?.customerId ?? null
  );
}

export function getInternalEntityOrganizationId(
  workflow: DealWorkflowProjection,
) {
  return (
    workflow.participants.find(
      (participant) => participant.role === "internal_entity",
    )?.organizationId ?? null
  );
}

export function findLegById(workflow: DealWorkflowProjection, legId: string) {
  return workflow.executionPlan.find((leg) => leg.id === legId) ?? null;
}

export async function requireWorkflow(
  dealsModule: Pick<DealsModule, "deals">,
  dealId: string,
) {
  const workflow = await dealsModule.deals.queries.findWorkflowById(dealId);

  if (!workflow) {
    throw new DealNotFoundError(dealId);
  }

  return workflow;
}
