import { DealNotFoundError, type DealsModule } from "@bedrock/deals";
import type { DealWorkflowProjection } from "@bedrock/deals/contracts";

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
