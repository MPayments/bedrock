import { z } from "zod";

import type { ModuleRuntime } from "@bedrock/shared/core";

import { DealNotFoundError } from "../../errors";
import {
  SupersedeDealCalculationInputSchema,
  type SupersedeDealCalculationInput,
} from "../contracts/commands";
import type { DealWorkflowProjection } from "../contracts/dto";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";
import type { DealReferencesPort } from "../ports/references.port";
import {
  buildDealOperationalPositionRows,
  createTimelinePayloadEvent,
  deriveDealRootState,
} from "../shared/workflow-state";

const SupersedeDealCalculationCommandInputSchema =
  SupersedeDealCalculationInputSchema.extend({
    actorUserId: z.string().trim().min(1),
    dealId: z.uuid(),
  });

type SupersedeDealCalculationCommandInput = SupersedeDealCalculationInput & {
  actorUserId: string;
  dealId: string;
};

export class SupersedeDealCalculationCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
    private readonly references: DealReferencesPort,
  ) {}

  async execute(
    raw: SupersedeDealCalculationCommandInput,
  ): Promise<DealWorkflowProjection> {
    const validated = SupersedeDealCalculationCommandInputSchema.parse(raw);
    const now = this.runtime.now();

    return this.commandUow.run(async (tx) => {
      const existing = await tx.dealReads.findWorkflowById(validated.dealId);

      if (!existing) {
        throw new DealNotFoundError(validated.dealId);
      }

      const isCurrentCalculation =
        existing.summary.calculationId === validated.calculationId;
      const linkedCalculationIds = new Set(
        existing.relatedResources.calculations.map((item) => item.id),
      );

      if (!isCurrentCalculation && !linkedCalculationIds.has(validated.calculationId)) {
        throw new DealNotFoundError(validated.dealId);
      }

      const status = "pricing" as const;
      const rootState = await deriveDealRootState({
        calculationId: isCurrentCalculation ? null : existing.summary.calculationId,
        header: existing.header,
        references: this.references,
        status,
      });

      await tx.dealStore.setDealRoot({
        calculationId: isCurrentCalculation ? null : existing.summary.calculationId,
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
            reason: validated.reason ?? null,
            status,
          },
          sourceRef: `calculation:${validated.calculationId}:superseded`,
          type: "calculation_superseded",
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
