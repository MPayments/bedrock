import { DealTransitionBlockedError } from "@bedrock/deals";
import type { DealWorkflowProjection } from "@bedrock/deals/contracts";
import type { ReconciliationOperationLinkDto } from "@bedrock/reconciliation/contracts";
import type {
  PaymentStep,
  QuoteExecution,
} from "@bedrock/treasury/contracts";
import { deriveFinanceDealReadiness } from "@bedrock/workflow-deal-projections";

import { DEAL_EXECUTION_CLOSE_SCOPE } from "../shared/constants";
import type { DealExecutionWorkflowDeps } from "../shared/deps";
import { runIdempotent } from "../shared/idempotency";
import { listAllDealLegRuntimes } from "../shared/runtime-pages";
import { buildTimelineEvent } from "../shared/timeline";
import { requireWorkflow } from "../shared/workflow-helpers";

export async function closeDeal(
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
    handler: async ({
      dealStore,
      dealsModule,
      reconciliation,
      treasuryModule,
    }) => {
      const workflow = await requireWorkflow(dealsModule, input.dealId);

      if (workflow.summary.status === "done") {
        return workflow;
      }

      const { paymentSteps, quoteExecutions } = await listAllDealLegRuntimes(
        treasuryModule,
        input.dealId,
      );
      const paymentStepByPlanLegId = new Map<string, PaymentStep>();
      for (const step of paymentSteps) {
        if (
          step.origin.type === "deal_execution_leg" &&
          step.origin.planLegId !== null
        ) {
          paymentStepByPlanLegId.set(step.origin.planLegId, step);
        }
      }
      const quoteExecutionByPlanLegId = new Map<string, QuoteExecution>();
      for (const execution of quoteExecutions) {
        if (
          execution.origin.type === "deal_execution_leg" &&
          execution.origin.planLegId !== null
        ) {
          quoteExecutionByPlanLegId.set(
            execution.origin.planLegId,
            execution,
          );
        }
      }
      const reconciliationLinks =
        paymentSteps.length > 0
          ? await reconciliation.links.listOperationLinks({
              operationIds: paymentSteps.map((step) => step.id),
            })
          : [];
      const reconciliationLinksByStepId = new Map(
        reconciliationLinks.map(
          (link): readonly [string, ReconciliationOperationLinkDto] => [
            link.operationId,
            link,
          ],
        ),
      );
      const { closeReadiness } = deriveFinanceDealReadiness({
        paymentStepByPlanLegId,
        quoteExecutionByPlanLegId,
        reconciliationLinksByStepId,
        workflow,
      });

      if (!closeReadiness.ready) {
        throw new DealTransitionBlockedError(
          "done",
          closeReadiness.blockers.map((message: string) => ({
            code: "execution_leg_not_done",
            message,
          })),
        );
      }

      const updated = await dealsModule.deals.commands.transitionStatus({
        actorUserId: input.actorUserId,
        comment: input.comment ?? null,
        dealId: input.dealId,
        status: "done",
      });

      await dealStore.createDealTimelineEvents([
        buildTimelineEvent({
          actorUserId: input.actorUserId,
          dealId: input.dealId,
          payload: {
            comment: input.comment ?? null,
            stepCount: paymentSteps.length + quoteExecutions.length,
          },
          sourceRef: `execution:${input.dealId}:close:${input.idempotencyKey}`,
          type: "deal_closed",
        }),
      ]);

      return updated.summary.status === "done"
        ? updated
        : requireWorkflow(dealsModule, input.dealId);
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
    scope: DEAL_EXECUTION_CLOSE_SCOPE,
    serializeResult: (result) => ({ dealId: result.summary.id }),
  });
}
