import type { CalculationsModule } from "@bedrock/calculations";
import {
  DealNotFoundError,
  DealQuoteInactiveError,
  DealQuoteNotAcceptedError,
  type DealsModule,
} from "@bedrock/deals";
import { ValidationError } from "@bedrock/shared/core/errors";
import type { TreasuryModule } from "@bedrock/treasury";

import { serializeQuoteDetails } from "../routes/internal/treasury-quote-dto";

type CanonicalCalculation = Awaited<
  ReturnType<CalculationsModule["calculations"]["commands"]["create"]>
>;
type TreasuryMarkQuoteUsedInput = Parameters<
  TreasuryModule["quotes"]["commands"]["markQuoteUsed"]
>[0];
type TreasuryQuoteRecord = Awaited<
  ReturnType<TreasuryModule["quotes"]["commands"]["markQuoteUsed"]>
>;
type ExpiredQuoteRecord = Awaited<
  ReturnType<TreasuryModule["quotes"]["commands"]["expireQuotes"]>
>[number];

export interface DealQuoteWorkflowDeps {
  calculations: Pick<CalculationsModule, "calculations">;
  deals: Pick<DealsModule, "deals">;
  treasury: Pick<TreasuryModule, "quotes">;
}

async function requireCurrentAcceptedQuote(input: {
  allowUsedDocumentId?: string | null;
  dealId: string;
  deals: DealQuoteWorkflowDeps["deals"];
  now: Date;
  quoteId: string;
}) {
  const workflow = await input.deals.deals.queries.findWorkflowById(
    input.dealId,
  );

  if (!workflow) {
    throw new DealNotFoundError(input.dealId);
  }

  if (workflow.acceptedQuote?.quoteId !== input.quoteId) {
    throw new DealQuoteNotAcceptedError(input.dealId, input.quoteId);
  }

  const sameUsedDocument = isAcceptedQuoteUsedBySameDocument({
    acceptedQuote: workflow.acceptedQuote,
    usedDocumentId: input.allowUsedDocumentId,
  });

  if (workflow.acceptedQuote.quoteStatus !== "active" && !sameUsedDocument) {
    throw new DealQuoteInactiveError(
      input.quoteId,
      workflow.acceptedQuote.quoteStatus,
    );
  }

  if (
    !sameUsedDocument &&
    workflow.acceptedQuote.expiresAt &&
    workflow.acceptedQuote.expiresAt.getTime() <= input.now.getTime()
  ) {
    throw new DealQuoteInactiveError(input.quoteId, "expired");
  }

  return workflow;
}

function isAcceptedQuoteUsedBySameDocument(input: {
  acceptedQuote: {
    quoteStatus: string;
    usedDocumentId: string | null;
  };
  usedDocumentId?: string | null;
}) {
  return (
    input.acceptedQuote.quoteStatus === "used" &&
    input.usedDocumentId != null &&
    input.acceptedQuote.usedDocumentId === input.usedDocumentId
  );
}

export function createDealQuoteWorkflow(deps: DealQuoteWorkflowDeps) {
  return {
    async createCalculationFromAcceptedQuote(input: {
      actorUserId: string;
      dealId: string;
      idempotencyKey: string;
      quoteId: string;
    }): Promise<CanonicalCalculation> {
      const workflow = await requireCurrentAcceptedQuote({
        dealId: input.dealId,
        deals: deps.deals,
        now: new Date(),
        quoteId: input.quoteId,
      });

      const quoteDetails = await deps.treasury.quotes.queries.getQuoteDetails({
        quoteRef: input.quoteId,
      });
      const quote = quoteDetails.quote;

      if (quote.dealId !== input.dealId) {
        throw new ValidationError(
          `Quote ${quote.id} is not linked to deal ${input.dealId}`,
        );
      }

      if (quote.status !== "active") {
        throw new DealQuoteInactiveError(quote.id, quote.status);
      }

      if (quote.expiresAt.getTime() <= Date.now()) {
        throw new DealQuoteInactiveError(quote.id, "expired");
      }

      if (!quote.fromCurrency || !quote.toCurrency) {
        throw new ValidationError(
          `Quote ${quote.id} is missing currency codes`,
        );
      }

      const acceptedAgreementVersionId =
        workflow.acceptedQuote?.agreementVersionId ?? null;

      const calculation =
        await deps.calculations.calculations.commands.createFromAcceptedQuote({
          actorUserId: input.actorUserId,
          acceptedAgreementVersionId,
          idempotencyKey: input.idempotencyKey,
          quoteDetails,
          quoteSnapshot: serializeQuoteDetails(quoteDetails),
        });

      await deps.deals.deals.commands.linkCalculationFromAcceptedQuote({
        actorUserId: input.actorUserId,
        calculationId: calculation.id,
        dealId: input.dealId,
        quoteId: quote.id,
      });

      return calculation;
    },

    async expireQuotes(now: Date): Promise<ExpiredQuoteRecord[]> {
      const expiredQuotes =
        await deps.treasury.quotes.commands.expireQuotes(now);

      await Promise.all(
        expiredQuotes
          .filter((quote) => quote.dealId)
          .map(async (quote) => {
            await deps.deals.deals.commands.appendTimelineEvent({
              dealId: quote.dealId!,
              payload: {
                expiresAt: quote.expiresAt,
                quoteId: quote.id,
              },
              sourceRef: `quote:${quote.id}:expired`,
              type: "quote_expired",
              visibility: "internal",
            });
          }),
      );

      return expiredQuotes;
    },

    async markQuoteUsed(
      input: TreasuryMarkQuoteUsedInput,
    ): Promise<TreasuryQuoteRecord> {
      const dealId = input.dealId ?? null;

      if (dealId) {
        await requireCurrentAcceptedQuote({
          allowUsedDocumentId: input.usedDocumentId ?? null,
          dealId,
          deals: deps.deals,
          now: input.at,
          quoteId: input.quoteId,
        });
      }

      const quote = await deps.treasury.quotes.commands.markQuoteUsed(input);
      const linkedDealId = quote.dealId ?? dealId;

      if (linkedDealId) {
        await deps.deals.deals.commands.appendTimelineEvent({
          dealId: linkedDealId,
          payload: {
            quoteId: quote.id,
            usedAt: quote.usedAt,
            usedByRef: quote.usedByRef,
            usedDocumentId: quote.usedDocumentId,
          },
          sourceRef: `quote:${quote.id}:used:${quote.usedByRef ?? "unknown"}`,
          type: "quote_used",
          visibility: "internal",
        });
      }

      return quote;
    },
  };
}

export type DealQuoteWorkflow = ReturnType<typeof createDealQuoteWorkflow>;
