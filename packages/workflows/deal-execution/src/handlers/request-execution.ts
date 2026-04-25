import type { DealWorkflowProjection } from "@bedrock/deals/contracts";

import { DEAL_EXECUTION_REQUEST_SCOPE } from "../shared/constants";
import type { DealExecutionWorkflowDeps } from "../shared/deps";
import { runIdempotent } from "../shared/idempotency";
import {
  materializeCompiledOperation,
  resolveRecipeContext,
} from "../shared/materialize";
import { buildTimelineEvent } from "../shared/timeline";
import {
  assertExecutionRequestAllowed,
  getCustomerId,
  requireWorkflow,
} from "../shared/workflow-helpers";

export async function requestExecution(
  deps: DealExecutionWorkflowDeps,
  input: {
    actorUserId: string;
    comment?: string | null;
    dealId: string;
    idempotencyKey: string;
  },
): Promise<DealWorkflowProjection> {
  return runIdempotent(deps, {
    actorUserId: input.actorUserId,
    handler: async ({ dealStore, dealsModule, treasuryModule }) => {
      const workflow = await requireWorkflow(dealsModule, input.dealId);

      const existingSteps = await treasuryModule.paymentSteps.queries.list({
        dealId: input.dealId,
        limit: 1,
        offset: 0,
        purpose: "deal_leg",
      });
      if (existingSteps.total > 0) {
        return workflow;
      }

      assertExecutionRequestAllowed(workflow);

      const recipeContext = await resolveRecipeContext(
        deps,
        treasuryModule,
        workflow,
      );
      const currencyCodeById = new Map<string, string>();
      const customerId = getCustomerId(workflow);

      for (const operation of recipeContext.recipe) {
        await materializeCompiledOperation({
          acceptedQuote: recipeContext.acceptedQuote,
          agreementOrganizationId: recipeContext.agreementOrganizationId,
          compiled: operation,
          currencies: deps.currencies,
          currencyCodeById,
          customerId,
          dealStore,
          internalEntityOrganizationId:
            recipeContext.internalEntityOrganizationId,
          treasuryModule,
          workflow,
        });
      }

      await dealStore.createDealTimelineEvents([
        buildTimelineEvent({
          actorUserId: input.actorUserId,
          dealId: workflow.summary.id,
          payload: {
            comment: input.comment ?? null,
            operationCount: recipeContext.recipe.length,
          },
          sourceRef: `execution:${workflow.summary.id}:request:${input.idempotencyKey}`,
          type: "execution_requested",
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
    },
    scope: DEAL_EXECUTION_REQUEST_SCOPE,
    serializeResult: (result) => ({ dealId: result.summary.id }),
  });
}
