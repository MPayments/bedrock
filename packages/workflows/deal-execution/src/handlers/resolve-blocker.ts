import type { DealWorkflowProjection } from "@bedrock/deals/contracts";
import { ValidationError } from "@bedrock/shared/core/errors";

import { DEAL_EXECUTION_RESOLVE_BLOCKER_SCOPE } from "../shared/constants";
import type { DealExecutionWorkflowDeps } from "../shared/deps";
import { runIdempotent } from "../shared/idempotency";
import { findLegById, requireWorkflow } from "../shared/workflow-helpers";

export async function resolveExecutionBlocker(
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
    handler: async ({ dealsModule }) => {
      const workflow = await requireWorkflow(dealsModule, input.dealId);

      const leg = findLegById(workflow, input.legId);
      if (!leg) {
        throw new ValidationError(
          `Deal ${input.dealId} does not have execution leg ${input.legId}`,
        );
      }

      if (leg.state !== "blocked") {
        return workflow;
      }

      return dealsModule.deals.commands.setLegManualOverride({
        actorUserId: input.actorUserId,
        comment: input.comment ?? null,
        dealId: input.dealId,
        idx: leg.idx,
        override: null,
      });
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
    scope: DEAL_EXECUTION_RESOLVE_BLOCKER_SCOPE,
    serializeResult: (result) => ({ dealId: result.summary.id }),
  });
}
