import {
  DealNotFoundError,
  DealTransitionBlockedError,
  type DealsModule,
} from "@bedrock/deals";
import type { DealWorkflowProjection } from "@bedrock/deals/contracts";
import { ValidationError } from "@bedrock/shared/core/errors";
import type { TreasuryModule } from "@bedrock/treasury";

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

export function getAllLinkedOperationIds(workflow: DealWorkflowProjection) {
  return workflow.executionPlan.flatMap((leg) =>
    leg.operationRefs.map((ref) => ref.operationId),
  );
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

export async function requireDealForOperation(
  treasuryModule: Pick<
    TreasuryModule,
    "instructions" | "operations" | "quotes"
  >,
  dealsModule: Pick<DealsModule, "deals">,
  operationId: string,
) {
  const operation =
    await treasuryModule.operations.queries.findById(operationId);

  if (!operation) {
    throw new ValidationError(`Treasury operation ${operationId} not found`);
  }

  if (!operation.dealId) {
    throw new ValidationError(
      `Treasury operation ${operationId} is not linked to a deal`,
    );
  }

  const workflow = await requireWorkflow(dealsModule, operation.dealId);

  return {
    operation,
    workflow,
  };
}

export async function requireInstructionForMutation(
  treasuryModule: Pick<
    TreasuryModule,
    "instructions" | "operations" | "quotes"
  >,
  dealsModule: Pick<DealsModule, "deals">,
  instructionId: string,
) {
  const instruction =
    await treasuryModule.instructions.queries.findById(instructionId);

  if (!instruction) {
    throw new ValidationError(
      `Treasury instruction ${instructionId} not found`,
    );
  }

  const operation = await treasuryModule.operations.queries.findById(
    instruction.operationId,
  );

  if (!operation) {
    throw new ValidationError(
      `Treasury instruction ${instructionId} references missing operation ${instruction.operationId}`,
    );
  }

  if (!operation.dealId) {
    throw new ValidationError(
      `Treasury operation ${operation.id} is not linked to a deal`,
    );
  }

  const workflow = await requireWorkflow(dealsModule, operation.dealId);

  return {
    instruction,
    operation,
    workflow,
  };
}
