import { z } from "zod";

import type { ModuleRuntime } from "@bedrock/shared/core";
import { NotFoundError } from "@bedrock/shared/core/errors";

import {
  DealCalculationInactiveError,
  DealNotFoundError,
  DealQuoteNotAcceptedError,
} from "../../errors";
import {
  AttachDealCalculationInputSchema,
  type AttachDealCalculationInput,
} from "../contracts/commands";
import type { DealDetails } from "../contracts/dto";
import { createTimelinePayloadEvent, deriveDealRootState } from "../shared/workflow-state";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";
import type { DealReferencesPort } from "../ports/references.port";

const AttachDealCalculationCommandInputSchema =
  AttachDealCalculationInputSchema.extend({
    actorUserId: z.string().trim().min(1),
    dealId: z.uuid(),
  });

type AttachDealCalculationCommandInput = AttachDealCalculationInput & {
  actorUserId: string;
  dealId: string;
};

export class AttachDealCalculationCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
    private readonly references: DealReferencesPort,
  ) {}

  async execute(raw: AttachDealCalculationCommandInput): Promise<DealDetails> {
    const validated = AttachDealCalculationCommandInputSchema.parse(raw);
    const calculation = await this.references.findCalculationById(
      validated.calculationId,
    );

    if (!calculation) {
      throw new NotFoundError("Calculation", validated.calculationId);
    }

    if (!calculation.isActive) {
      throw new DealCalculationInactiveError(validated.calculationId);
    }

    return this.commandUow.run(async (tx) => {
      const existing = await tx.dealReads.findWorkflowById(validated.dealId);
      if (!existing) {
        throw new DealNotFoundError(validated.dealId);
      }

      if (
        validated.sourceQuoteId &&
        existing.acceptedQuote?.quoteId !== validated.sourceQuoteId
      ) {
        throw new DealQuoteNotAcceptedError(
          validated.dealId,
          validated.sourceQuoteId,
        );
      }

      const rootState = await deriveDealRootState({
        acceptance: existing.acceptedQuote,
        calculationId: validated.calculationId,
        intake: existing.intake,
        references: this.references,
        status: existing.summary.status,
      });

      await tx.dealStore.setDealRoot({
        calculationId: validated.calculationId,
        dealId: validated.dealId,
        nextAction: rootState.nextAction,
      });
      await tx.dealStore.createDealCalculationLinks([
        {
          calculationId: validated.calculationId,
          dealId: validated.dealId,
          id: this.runtime.generateUuid(),
          sourceQuoteId: validated.sourceQuoteId ?? null,
        },
      ]);
      await tx.dealStore.createDealTimelineEvents([
        createTimelinePayloadEvent({
          actorUserId: validated.actorUserId,
          dealId: validated.dealId,
          generateUuid: () => this.runtime.generateUuid(),
          occurredAt: this.runtime.now(),
          payload: {
            calculationId: validated.calculationId,
            quoteId: validated.sourceQuoteId ?? null,
          },
          type: "calculation_attached",
          visibility: "internal",
        }),
      ]);

      const updated = await tx.dealReads.findById(validated.dealId);
      if (!updated) {
        throw new DealNotFoundError(validated.dealId);
      }

      return updated;
    });
  }
}
