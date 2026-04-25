import type { DealWorkflowProjection } from "@bedrock/deals/contracts";
import { ValidationError } from "@bedrock/shared/core/errors";

import { DEAL_EXECUTION_CREATE_LEG_OPERATION_SCOPE } from "../shared/constants";
import type { DealExecutionWorkflowDeps } from "../shared/deps";
import { runIdempotent } from "../shared/idempotency";
import {
  materializeCompiledOperation,
  resolveRecipeContext,
} from "../shared/materialize";
import { buildTimelineEvent } from "../shared/timeline";
import {
  findLegById,
  getCustomerId,
  requireWorkflow,
} from "../shared/workflow-helpers";

export async function createLegOperation(
  deps: DealExecutionWorkflowDeps,
  input: {
    actorUserId: string;
    comment?: string | null;
    dealId: string;
    idempotencyKey: string;
    legId: string;
  },
): Promise<DealWorkflowProjection> {
  return runIdempotent(deps, {
    actorUserId: input.actorUserId,
    handler: async ({ dealStore, dealsModule, treasuryModule }) => {
      const workflow = await requireWorkflow(dealsModule, input.dealId);
      const leg = findLegById(workflow, input.legId);

      if (!leg) {
        throw new ValidationError(
          `Deal ${input.dealId} does not have execution leg ${input.legId}`,
        );
      }

      if (leg.state === "skipped") {
        throw new ValidationError(
          `Deal ${input.dealId} execution leg ${input.legId} is skipped and cannot materialize an operation`,
        );
      }

      const existingSteps = await treasuryModule.paymentSteps.queries.list({
        dealId: input.dealId,
        limit: 100,
        offset: 0,
        purpose: "deal_leg",
      });
      if (existingSteps.data.some((step) => step.dealLegIdx === leg.idx)) {
        return workflow;
      }

      const recipeContext = await resolveRecipeContext(
        deps,
        treasuryModule,
        workflow,
      );
      const compiled = recipeContext.recipe.find(
        (item) => item.legId === input.legId,
      );

      if (!compiled) {
        throw new ValidationError(
          `Deal ${input.dealId} does not have a materializable recipe for leg ${input.legId}`,
        );
      }

      const operation = await materializeCompiledOperation({
        acceptedQuote: recipeContext.acceptedQuote,
        agreementOrganizationId: recipeContext.agreementOrganizationId,
        compiled,
        currencies: deps.currencies,
        currencyCodeById: new Map<string, string>(),
        customerId: getCustomerId(workflow),
        dealStore,
        internalEntityOrganizationId:
          recipeContext.internalEntityOrganizationId,
        treasuryModule,
        workflow,
      });

      if (!operation) {
        throw new ValidationError(
          `Deal ${input.dealId} could not materialize a payment step for leg ${input.legId}`,
        );
      }

      await dealStore.createDealTimelineEvents([
        buildTimelineEvent({
          actorUserId: input.actorUserId,
          dealId: workflow.summary.id,
          payload: {
            comment: input.comment ?? null,
            legId: compiled.legId,
            legIdx: compiled.legIdx,
            operationId: operation.id,
            operationKind: compiled.operationKind,
          },
          sourceRef: `execution:${workflow.summary.id}:leg:${compiled.legId}:operation:${input.idempotencyKey}`,
          type: "leg_operation_created",
        }),
      ]);

      return requireWorkflow(dealsModule, input.dealId);
    },
    idempotencyKey: input.idempotencyKey,
    loadReplayResult: async ({ dealsModule }, storedResult) => {
      const dealId = String(storedResult?.dealId ?? input.dealId);
      return requireWorkflow(dealsModule, dealId);
    },
    request: {
      comment: input.comment ?? null,
      dealId: input.dealId,
      legId: input.legId,
    },
    scope: DEAL_EXECUTION_CREATE_LEG_OPERATION_SCOPE,
    serializeResult: (result) => ({ dealId: result.summary.id }),
  });
}
