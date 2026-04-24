import { DealTransitionBlockedError } from "@bedrock/deals";
import type { DealWorkflowProjection } from "@bedrock/deals/contracts";
import type { ReconciliationOperationLinkDto } from "@bedrock/reconciliation/contracts";
import { deriveFinanceDealReadiness } from "@bedrock/workflow-deal-projections";

import { DEAL_EXECUTION_CLOSE_SCOPE } from "../shared/constants";
import type { DealExecutionWorkflowDeps } from "../shared/deps";
import { runIdempotent } from "../shared/idempotency";
import { buildTimelineEvent } from "../shared/timeline";
import {
  getAllLinkedOperationIds,
  requireWorkflow,
} from "../shared/workflow-helpers";

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

      const linkedOperationIds = getAllLinkedOperationIds(workflow);
      const latestInstructions =
        await treasuryModule.instructions.queries.listLatestByOperationIds(
          linkedOperationIds,
        );
      const instructionByOperationId = new Map(
        latestInstructions.map(
          (instruction) => [instruction.operationId, instruction] as const,
        ),
      );
      const reconciliationLinks =
        await reconciliation.links.listOperationLinks({
          operationIds: linkedOperationIds,
        });
      const reconciliationLinksByOperationId = new Map(
        reconciliationLinks.map(
          (link): readonly [string, ReconciliationOperationLinkDto] => [
            link.operationId,
            link,
          ],
        ),
      );
      const { closeReadiness } = deriveFinanceDealReadiness({
        latestInstructionByOperationId: instructionByOperationId,
        reconciliationLinksByOperationId,
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
            instructionCount: latestInstructions.length,
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
