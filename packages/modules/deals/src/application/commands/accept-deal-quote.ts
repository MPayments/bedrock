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
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";
import type { DealReferencesPort } from "../ports/references.port";
import {
  buildDealOperationalPositionRows,
  createTimelinePayloadEvent,
  deriveDealRootState,
} from "../shared/workflow-state";

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
    const now = this.runtime.now();

    return this.commandUow.run(async (tx) => {
      const existing = await tx.dealReads.findWorkflowById(validated.dealId);
      if (!existing) {
        throw new DealNotFoundError(validated.dealId);
      }

      const quote = await this.references.findQuoteById(validated.quoteId);
      if (!quote) {
        throw new NotFoundError("Quote", validated.quoteId);
      }
      const quoteExpired =
        quote.expiresAt !== null && quote.expiresAt.getTime() <= now.getTime();
      if (quote.dealId !== validated.dealId) {
        throw new DealQuoteDealMismatchError(validated.dealId, validated.quoteId);
      }
      if (
        existing.acceptedQuote?.quoteId === validated.quoteId &&
        existing.acceptedQuote.dealRevision === existing.revision &&
        quote.status === "active" &&
        !quoteExpired
      ) {
        return existing;
      }
      if (quote.status !== "active" || quoteExpired) {
        throw new DealQuoteInactiveError(
          validated.quoteId,
          quoteExpired ? "expired" : quote.status,
        );
      }

      const agreement = await this.references.findAgreementById(
        existing.summary.agreementId,
      );
      const agreementVersionId =
        quote.agreementVersionId ?? agreement?.currentVersionId ?? null;

      await tx.dealStore.supersedeCurrentQuoteAcceptances({
        dealId: validated.dealId,
        replacedByQuoteId: validated.quoteId,
        revokedAt: now,
      });
      const acceptanceId = this.runtime.generateUuid();
      await tx.dealStore.createDealQuoteAcceptance({
        acceptedAt: now,
        acceptedByUserId: validated.actorUserId,
        agreementVersionId,
        dealId: validated.dealId,
        dealRevision: existing.revision,
        id: acceptanceId,
        quoteId: validated.quoteId,
      });

      const rootState = await deriveDealRootState({
        acceptance: {
          acceptedAt: now,
          acceptedByUserId: validated.actorUserId,
          agreementVersionId,
          dealId: validated.dealId,
          dealRevision: existing.revision,
          expiresAt: quote.expiresAt ?? null,
          id: acceptanceId,
          quoteId: validated.quoteId,
          quoteStatus: quote.status,
          replacedByQuoteId: null,
          revocationReason: null,
          revokedAt: null,
          usedAt: quote.usedAt ?? null,
          usedDocumentId: quote.usedDocumentId ?? null,
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
            replacedQuoteId: existing.acceptedQuote?.quoteId ?? null,
            quoteId: validated.quoteId,
            dealRevision: existing.revision,
          },
          sourceRef: `quote:${validated.quoteId}:accepted`,
          type: "quote_accepted",
          visibility: "internal",
        }),
      ]);

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
