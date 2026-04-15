import { z } from "zod";

import type { ModuleRuntime } from "@bedrock/shared/core";

import { DealNotFoundError } from "../../errors";
import {
  AcceptDealCalculationInputSchema,
  type AcceptDealCalculationInput,
} from "../contracts/commands";
import type { DealApproval, DealWorkflowProjection } from "../contracts/dto";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";
import type { DealReferencesPort } from "../ports/references.port";
import {
  buildDealOperationalPositionRows,
  createTimelinePayloadEvent,
  deriveDealRootState,
} from "../shared/workflow-state";

const AcceptDealCalculationCommandInputSchema =
  AcceptDealCalculationInputSchema.extend({
    actorUserId: z.string().trim().min(1),
    dealId: z.uuid(),
  });

type AcceptDealCalculationCommandInput = AcceptDealCalculationInput & {
  actorUserId: string;
  dealId: string;
};

function latestApprovalByType(
  approvals: DealApproval[],
  approvalType: DealApproval["approvalType"],
) {
  return [...approvals]
    .filter((approval) => approval.approvalType === approvalType)
    .sort((left, right) => right.requestedAt.getTime() - left.requestedAt.getTime())
    .at(0) ?? null;
}

function resolveStatusAfterAcceptedCalculation(approvals: DealApproval[]) {
  const customerApproved =
    latestApprovalByType(approvals, "commercial")?.status === "approved";
  const internalApproved =
    latestApprovalByType(approvals, "operations")?.status === "approved";

  if (customerApproved && internalApproved) {
    return "approved_for_execution" as const;
  }

  if (customerApproved) {
    return "awaiting_internal_approval" as const;
  }

  return "awaiting_customer_approval" as const;
}

export class AcceptDealCalculationCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
    private readonly references: DealReferencesPort,
  ) {}

  async execute(
    raw: AcceptDealCalculationCommandInput,
  ): Promise<DealWorkflowProjection> {
    const validated = AcceptDealCalculationCommandInputSchema.parse(raw);
    const now = this.runtime.now();

    return this.commandUow.run(async (tx) => {
      const [existing, details] = await Promise.all([
        tx.dealReads.findWorkflowById(validated.dealId),
        tx.dealReads.findById(validated.dealId),
      ]);

      if (!existing || !details) {
        throw new DealNotFoundError(validated.dealId);
      }

      const linkedCalculationIds = new Set(
        existing.relatedResources.calculations.map((item) => item.id),
      );
      if (
        existing.summary.calculationId !== validated.calculationId &&
        !linkedCalculationIds.has(validated.calculationId)
      ) {
        throw new DealNotFoundError(validated.dealId);
      }

      const status = resolveStatusAfterAcceptedCalculation(details.approvals);
      const rootState = await deriveDealRootState({
        calculationId: validated.calculationId,
        header: existing.header,
        references: this.references,
        status,
      });

      await tx.dealStore.setDealRoot({
        calculationId: validated.calculationId,
        dealId: validated.dealId,
        nextAction: rootState.nextAction,
        status,
      });
      await tx.dealStore.createDealTimelineEvents([
        createTimelinePayloadEvent({
          actorUserId: validated.actorUserId,
          dealId: validated.dealId,
          generateUuid: () => this.runtime.generateUuid(),
          occurredAt: now,
          payload: {
            calculationId: validated.calculationId,
            status,
          },
          sourceRef: `calculation:${validated.calculationId}:accepted`,
          type: "calculation_accepted",
          visibility: "internal",
        }),
      ]);

      const updated = await tx.dealReads.findWorkflowById(validated.dealId);

      if (!updated) {
        throw new DealNotFoundError(validated.dealId);
      }

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
