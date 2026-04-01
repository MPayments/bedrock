import { z } from "zod";

import type { ModuleRuntime } from "@bedrock/shared/core";
import { NotFoundError } from "@bedrock/shared/core/errors";

import {
  DealNotFoundError,
  DealQuoteDealMismatchError,
  DealQuoteInactiveError,
} from "../../errors";
import {
  AcceptDealQuoteInputSchema,
  type AcceptDealQuoteInput,
} from "../contracts/commands";
import type { DealWorkflowProjection } from "../contracts/dto";
import { createTimelinePayloadEvent, deriveDealRootState } from "../shared/workflow-state";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";
import type { DealReferencesPort } from "../ports/references.port";

const AcceptDealQuoteCommandInputSchema = AcceptDealQuoteInputSchema.extend({
  actorUserId: z.string().trim().min(1),
  dealId: z.uuid(),
});

type AcceptDealQuoteCommandInput = AcceptDealQuoteInput & {
  actorUserId: string;
  dealId: string;
};

export class AcceptDealQuoteCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
    private readonly references: DealReferencesPort,
  ) {}

  async execute(
    raw: AcceptDealQuoteCommandInput,
  ): Promise<DealWorkflowProjection> {
    const validated = AcceptDealQuoteCommandInputSchema.parse(raw);

    return this.commandUow.run(async (tx) => {
      const existing = await tx.dealReads.findWorkflowById(validated.dealId);
      if (!existing) {
        throw new DealNotFoundError(validated.dealId);
      }

      const quote = await this.references.findQuoteById(validated.quoteId);
      if (!quote) {
        throw new NotFoundError("Quote", validated.quoteId);
      }
      if (quote.dealId !== validated.dealId) {
        throw new DealQuoteDealMismatchError(validated.dealId, validated.quoteId);
      }
      if (quote.status !== "active") {
        throw new DealQuoteInactiveError(validated.quoteId, quote.status);
      }

      const agreement = await this.references.findAgreementById(
        existing.summary.agreementId,
      );
      const now = this.runtime.now();

      await tx.dealStore.supersedeCurrentQuoteAcceptances({
        dealId: validated.dealId,
        replacedByQuoteId: validated.quoteId,
        revokedAt: now,
      });
      await tx.dealStore.createDealQuoteAcceptance({
        acceptedAt: now,
        acceptedByUserId: validated.actorUserId,
        agreementVersionId: agreement?.currentVersionId ?? null,
        dealId: validated.dealId,
        dealRevision: existing.revision,
        id: this.runtime.generateUuid(),
        quoteId: validated.quoteId,
      });

      const rootState = await deriveDealRootState({
        acceptance: {
          acceptedAt: now,
          acceptedByUserId: validated.actorUserId,
          agreementVersionId: agreement?.currentVersionId ?? null,
          dealId: validated.dealId,
          dealRevision: existing.revision,
          id: this.runtime.generateUuid(),
          quoteId: validated.quoteId,
          replacedByQuoteId: null,
          revokedAt: null,
        },
        calculationId: existing.summary.calculationId,
        intake: existing.intake,
        references: this.references,
        status: existing.summary.status,
      });

      await tx.dealStore.setDealRoot({
        dealId: validated.dealId,
        nextAction: rootState.nextAction,
      });
      await tx.dealStore.createDealTimelineEvents([
        createTimelinePayloadEvent({
          actorUserId: validated.actorUserId,
          dealId: validated.dealId,
          generateUuid: () => this.runtime.generateUuid(),
          occurredAt: now,
          payload: {
            quoteId: validated.quoteId,
            revision: existing.revision,
          },
          type: "quote_used",
          visibility: "internal",
        }),
      ]);

      const updated = await tx.dealReads.findWorkflowById(validated.dealId);
      if (!updated) {
        throw new DealNotFoundError(validated.dealId);
      }

      return updated;
    });
  }
}
