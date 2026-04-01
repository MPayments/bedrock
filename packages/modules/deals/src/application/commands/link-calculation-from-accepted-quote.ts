import { z } from "zod";

import type { ModuleRuntime } from "@bedrock/shared/core";
import { NotFoundError } from "@bedrock/shared/core/errors";

import {
  DealCalculationInactiveError,
  DealNotFoundError,
  DealQuoteInactiveError,
  DealQuoteNotAcceptedError,
} from "../../errors";
import {
  LinkDealCalculationFromAcceptedQuoteInputSchema,
  type LinkDealCalculationFromAcceptedQuoteInput,
} from "../contracts/commands";
import type { DealDetails } from "../contracts/dto";
import {
  buildDealOperationalPositionRows,
  createTimelinePayloadEvent,
  deriveDealRootState,
} from "../shared/workflow-state";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";
import type { DealReferencesPort } from "../ports/references.port";

const LinkCalculationFromAcceptedQuoteCommandInputSchema =
  LinkDealCalculationFromAcceptedQuoteInputSchema.extend({
    actorUserId: z.string().trim().min(1),
    dealId: z.uuid(),
  });

type LinkCalculationFromAcceptedQuoteCommandInput =
  LinkDealCalculationFromAcceptedQuoteInput & {
    actorUserId: string;
    dealId: string;
  };

export class LinkCalculationFromAcceptedQuoteCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
    private readonly references: DealReferencesPort,
  ) {}

  async execute(
    raw: LinkCalculationFromAcceptedQuoteCommandInput,
  ): Promise<DealDetails> {
    const validated = LinkCalculationFromAcceptedQuoteCommandInputSchema.parse(raw);
    const calculation = await this.references.findCalculationById(
      validated.calculationId,
    );

    if (!calculation) {
      throw new NotFoundError("Calculation", validated.calculationId);
    }

    if (!calculation.isActive) {
      throw new DealCalculationInactiveError(validated.calculationId);
    }

    const quote = await this.references.findQuoteById(validated.quoteId);
    if (!quote) {
      throw new NotFoundError("Quote", validated.quoteId);
    }
    const now = this.runtime.now();
    const quoteExpired =
      quote.expiresAt !== null && quote.expiresAt.getTime() <= now.getTime();
    if (quote.status !== "active" || quoteExpired) {
      throw new DealQuoteInactiveError(
        validated.quoteId,
        quoteExpired ? "expired" : quote.status,
      );
    }

    return this.commandUow.run(async (tx) => {
      const existing = await tx.dealReads.findWorkflowById(validated.dealId);
      if (!existing) {
        throw new DealNotFoundError(validated.dealId);
      }

      if (existing.acceptedQuote?.quoteId !== validated.quoteId) {
        throw new DealQuoteNotAcceptedError(
          validated.dealId,
          validated.quoteId,
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
          sourceQuoteId: validated.quoteId,
        },
      ]);
      await tx.dealStore.createDealTimelineEvents([
        createTimelinePayloadEvent({
          actorUserId: validated.actorUserId,
          dealId: validated.dealId,
          generateUuid: () => this.runtime.generateUuid(),
          occurredAt: now,
          payload: {
            calculationId: validated.calculationId,
            quoteId: validated.quoteId,
          },
          sourceRef: `calculation:${validated.calculationId}:quote:${validated.quoteId}`,
          type: "calculation_attached",
          visibility: "internal",
        }),
      ]);

      const updatedWorkflow = await tx.dealReads.findWorkflowById(validated.dealId);
      if (!updatedWorkflow) {
        throw new DealNotFoundError(validated.dealId);
      }

      await tx.dealStore.setDealRoot({
        dealId: validated.dealId,
        nextAction: updatedWorkflow.nextAction,
      });
      await tx.dealStore.replaceDealOperationalPositions({
        dealId: validated.dealId,
        positions: buildDealOperationalPositionRows({
          dealId: validated.dealId,
          generateUuid: () => this.runtime.generateUuid(),
          operationalState: updatedWorkflow.operationalState,
        }),
      });

      const updated = await tx.dealReads.findById(validated.dealId);
      if (!updated) {
        throw new DealNotFoundError(validated.dealId);
      }

      return updated;
    });
  }
}
