import { z } from "zod";

import type { ModuleRuntime } from "@bedrock/shared/core";
import { ValidationError } from "@bedrock/shared/core/errors";

import { canDealWriteTreasuryOrFormalDocuments } from "../../domain/constants";
import {
  DealNotFoundError,
  DealPricingContextRevisionConflictError,
} from "../../errors";
import {
  AmendDealLegInputSchema,
  type AmendDealLegInput,
} from "../contracts/commands";
import type { DealWorkflowProjection } from "../contracts/dto";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";
import {
  applyDealLegRouteAmendment,
  type DealLegRouteAmendment,
} from "../shared/pricing-context";
import {
  buildDealOperationalPositionRows,
  createTimelinePayloadEvent,
} from "../shared/workflow-state";

const AmendDealLegCommandInputSchema = AmendDealLegInputSchema.and(
  z.object({
    actorUserId: z.string().trim().min(1),
    dealId: z.uuid(),
  }),
);

export type AmendDealLegCommandInput = AmendDealLegInput & {
  actorUserId: string;
  dealId: string;
};

export class AmendDealLegCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
  ) {}

  async execute(
    raw: AmendDealLegCommandInput,
  ): Promise<DealWorkflowProjection> {
    const validated = AmendDealLegCommandInputSchema.parse(raw);

    return this.commandUow.run(async (tx) => {
      const workflow = await tx.dealReads.findWorkflowById(validated.dealId);
      if (!workflow) {
        throw new DealNotFoundError(validated.dealId);
      }

      if (
        !canDealWriteTreasuryOrFormalDocuments({
          status: workflow.summary.status,
          type: workflow.summary.type,
        })
      ) {
        throw new ValidationError(
          `Deal ${validated.dealId} in status ${workflow.summary.status} does not allow amendments`,
        );
      }

      const leg = workflow.executionPlan.find(
        (candidate) => candidate.idx === validated.legIdx,
      );
      if (!leg) {
        throw new ValidationError(
          `Deal ${validated.dealId} has no leg at index ${validated.legIdx}`,
        );
      }

      if (leg.state === "in_progress" || leg.state === "done") {
        throw new ValidationError(
          `Cannot amend leg ${validated.legIdx}: leg is ${leg.state} (instruction already in flight)`,
        );
      }

      const existing = await tx.dealReads.findPricingContextByDealId(
        validated.dealId,
      );

      const amendment: DealLegRouteAmendment = {
        executionCounterpartyId: validated.changes.executionCounterpartyId,
        fees: validated.changes.fees,
        legIdx: validated.legIdx,
        requisiteId: validated.changes.requisiteId,
      };

      const amended = applyDealLegRouteAmendment({
        amendment,
        context: existing,
      });

      const replaced = await tx.dealStore.replaceDealPricingContext({
        dealId: validated.dealId,
        expectedRevision: existing.revision,
        nextRevision: existing.revision + 1,
        snapshot: amended.snapshot,
      });

      if (!replaced) {
        throw new DealPricingContextRevisionConflictError(
          validated.dealId,
          existing.revision,
        );
      }

      const now = this.runtime.now();
      const events: Parameters<
        typeof tx.dealStore.createDealTimelineEvents
      >[0] = [];

      events.push(
        createTimelinePayloadEvent({
          actorUserId: validated.actorUserId,
          dealId: validated.dealId,
          generateUuid: () => this.runtime.generateUuid(),
          occurredAt: now,
          payload: {
            after: amended.after,
            amendmentKind: validated.amendmentKind,
            approvalStatus: "auto",
            before: amended.before,
            legIdx: validated.legIdx,
            legKind: leg.kind,
            memo: validated.memo ?? null,
            reasonCode: validated.reasonCode,
          },
          type: "deal_leg_amended",
          visibility: "internal",
        }),
      );

      if (
        validated.amendmentKind === "commercial" &&
        workflow.acceptedQuote &&
        !workflow.acceptedQuote.revokedAt
      ) {
        const revoked = await tx.dealStore.revokeCurrentQuoteAcceptances({
          dealId: validated.dealId,
          revocationReason: "operator_commercial_amendment",
          revokedAt: now,
        });

        if (revoked) {
          events.push(
            createTimelinePayloadEvent({
              actorUserId: validated.actorUserId,
              dealId: validated.dealId,
              generateUuid: () => this.runtime.generateUuid(),
              occurredAt: now,
              payload: {
                amendmentSource: "leg_amendment",
                approvalStatus: "auto",
                legIdx: validated.legIdx,
                reasonCode: validated.reasonCode,
                revocationReason: "operator_commercial_amendment",
              },
              type: "acceptance_revoked_by_operator",
              visibility: "internal",
            }),
          );
        }
      }

      await tx.dealStore.createDealTimelineEvents(events);

      const updated = await tx.dealReads.findWorkflowById(validated.dealId);
      if (!updated) {
        throw new DealNotFoundError(validated.dealId);
      }

      await tx.dealStore.setDealRoot({
        dealId: validated.dealId,
        nextAction: updated.nextAction,
      });
      await tx.dealStore.replaceDealOperationalPositions({
        dealId: validated.dealId,
        positions: buildDealOperationalPositionRows({
          dealId: validated.dealId,
          generateUuid: () => this.runtime.generateUuid(),
          operationalState: updated.operationalState,
        }),
      });

      return updated;
    });
  }
}
