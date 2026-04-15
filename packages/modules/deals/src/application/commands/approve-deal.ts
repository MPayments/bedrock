import { z } from "zod";

import type { ModuleRuntime } from "@bedrock/shared/core";

import { DealNotFoundError } from "../../errors";
import {
  ApproveDealInputSchema,
  type ApproveDealInput,
} from "../contracts/commands";
import type { DealApproval, DealWorkflowProjection } from "../contracts/dto";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";
import type { DealReferencesPort } from "../ports/references.port";
import {
  buildDealOperationalPositionRows,
  createTimelinePayloadEvent,
  deriveDealRootState,
} from "../shared/workflow-state";

const ApproveDealCommandInputSchema = ApproveDealInputSchema.extend({
  actorUserId: z.string().trim().min(1),
  dealId: z.uuid(),
});

type ApproveDealCommandInput = ApproveDealInput & {
  actorUserId: string;
  dealId: string;
};

function approvalTypeFromScope(scope: "customer" | "internal") {
  return scope === "customer" ? "commercial" : "operations";
}

function latestApprovalByType(
  approvals: DealApproval[],
  approvalType: DealApproval["approvalType"],
) {
  return [...approvals]
    .filter((approval) => approval.approvalType === approvalType)
    .sort((left, right) => right.requestedAt.getTime() - left.requestedAt.getTime())
    .at(0) ?? null;
}

function resolveStatusAfterApproval(input: {
  approvals: DealApproval[];
  scope: "customer" | "internal";
}) {
  const customerStatus =
    input.scope === "customer"
      ? "approved"
      : (latestApprovalByType(input.approvals, "commercial")?.status ?? null);
  const internalStatus =
    input.scope === "internal"
      ? "approved"
      : (latestApprovalByType(input.approvals, "operations")?.status ?? null);

  if (customerStatus === "approved" && internalStatus === "approved") {
    return "approved_for_execution" as const;
  }

  if (customerStatus === "approved") {
    return "awaiting_internal_approval" as const;
  }

  return "awaiting_customer_approval" as const;
}

export class ApproveDealCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
    private readonly references: DealReferencesPort,
  ) {}

  async execute(
    raw: ApproveDealCommandInput,
  ): Promise<DealWorkflowProjection> {
    const validated = ApproveDealCommandInputSchema.parse(raw);
    const now = this.runtime.now();

    return this.commandUow.run(async (tx) => {
      const [existing, details] = await Promise.all([
        tx.dealReads.findWorkflowById(validated.dealId),
        tx.dealReads.findById(validated.dealId),
      ]);

      if (!existing || !details) {
        throw new DealNotFoundError(validated.dealId);
      }

      const status = resolveStatusAfterApproval({
        approvals: details.approvals,
        scope: validated.scope,
      });
      const rootState = await deriveDealRootState({
        calculationId: existing.summary.calculationId,
        header: existing.header,
        references: this.references,
        status,
      });

      await tx.dealStore.createDealApprovals([
        {
          approvalType: approvalTypeFromScope(validated.scope),
          comment: validated.comment ?? null,
          dealId: validated.dealId,
          decidedAt: now,
          decidedBy: validated.actorUserId,
          id: this.runtime.generateUuid(),
          requestedAt: now,
          requestedBy: validated.actorUserId,
          status: "approved",
        },
      ]);
      await tx.dealStore.setDealRoot({
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
            comment: validated.comment ?? null,
            scope: validated.scope,
            status,
          },
          sourceRef: `deal-approval:${validated.scope}:approved`,
          type: "deal_approved",
          visibility: validated.scope === "customer" ? "customer_safe" : "internal",
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
