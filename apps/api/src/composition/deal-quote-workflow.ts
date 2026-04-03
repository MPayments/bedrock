import type { CalculationsModule } from "@bedrock/calculations";
import type { CurrenciesService } from "@bedrock/currencies";
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
  currencies: Pick<CurrenciesService, "findByCode">;
  deals: Pick<DealsModule, "deals">;
  treasury: Pick<TreasuryModule, "quotes">;
}

async function requireCurrentAcceptedQuote(input: {
  dealId: string;
  deals: DealQuoteWorkflowDeps["deals"];
  now: Date;
  quoteId: string;
}) {
  const workflow = await input.deals.deals.queries.findWorkflowById(input.dealId);

  if (!workflow) {
    throw new DealNotFoundError(input.dealId);
  }

  if (workflow.acceptedQuote?.quoteId !== input.quoteId) {
    throw new DealQuoteNotAcceptedError(input.dealId, input.quoteId);
  }

  if (workflow.acceptedQuote.quoteStatus !== "active") {
    throw new DealQuoteInactiveError(
      input.quoteId,
      workflow.acceptedQuote.quoteStatus,
    );
  }

  if (
    workflow.acceptedQuote.expiresAt &&
    workflow.acceptedQuote.expiresAt.getTime() <= input.now.getTime()
  ) {
    throw new DealQuoteInactiveError(input.quoteId, "expired");
  }

  return workflow;
}

export function createDealQuoteWorkflow(deps: DealQuoteWorkflowDeps) {
  return {
    async createCalculationFromAcceptedQuote(input: {
      actorUserId: string;
      dealId: string;
      idempotencyKey: string;
      quoteId: string;
    }): Promise<CanonicalCalculation> {
      await requireCurrentAcceptedQuote({
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
        throw new ValidationError(`Quote ${quote.id} is missing currency codes`);
      }

      const currencyCodes = new Set(
        quoteDetails.financialLines.map((line) => line.currency),
      );
      const currencies = await Promise.all(
        Array.from(currencyCodes).map((code) => deps.currencies.findByCode(code)),
      );
      const currencyIdByCode = new Map(
        currencies.map((currency) => [currency.code, currency.id]),
      );

      const feeAmountMinor = quoteDetails.financialLines.reduce(
        (total, line) =>
          line.bucket === "fee_revenue" && line.currency === quote.fromCurrency
            ? total + line.amountMinor
            : total,
        0n,
      );
      const additionalExpensesAmountMinor = quoteDetails.financialLines.reduce(
        (total, line) =>
          line.bucket === "pass_through" && line.currency === quote.toCurrency
            ? total + line.amountMinor
            : total,
        0n,
      );

      if (feeAmountMinor < 0n) {
        throw new ValidationError(
          `Quote ${quote.id} has negative fee_revenue total`,
        );
      }

      if (additionalExpensesAmountMinor < 0n) {
        throw new ValidationError(
          `Quote ${quote.id} has negative pass_through total`,
        );
      }

      const originalAmountMinor = quote.fromAmountMinor;
      const feeBps =
        originalAmountMinor === 0n
          ? 0n
          : (feeAmountMinor * 10000n) / originalAmountMinor;
      const totalAmountMinor = originalAmountMinor + feeAmountMinor;
      const feeAmountInBaseMinor = (feeAmountMinor * quote.rateNum) / quote.rateDen;
      const totalInBaseMinor = quote.toAmountMinor;
      const additionalExpensesCurrencyId =
        additionalExpensesAmountMinor === 0n ? null : quote.toCurrencyId;
      const additionalExpensesInBaseMinor = additionalExpensesAmountMinor;
      const totalWithExpensesInBaseMinor =
        totalInBaseMinor + feeAmountInBaseMinor + additionalExpensesInBaseMinor;

      const financialLines = quoteDetails.financialLines
        .filter((line) => line.amountMinor !== 0n)
        .map((line) => {
          const currencyId = currencyIdByCode.get(line.currency);
          if (!currencyId) {
            throw new ValidationError(`Currency ${line.currency} is not configured`);
          }

          return {
            kind: line.bucket,
            currencyId,
            amountMinor: line.amountMinor.toString(),
          };
        });

      const calculation = await deps.calculations.calculations.commands.create({
        actorUserId: input.actorUserId,
        additionalExpensesAmountMinor:
          additionalExpensesAmountMinor.toString(),
        additionalExpensesCurrencyId,
        additionalExpensesInBaseMinor:
          additionalExpensesInBaseMinor.toString(),
        additionalExpensesRateDen: null,
        additionalExpensesRateNum: null,
        additionalExpensesRateSource: null,
        baseCurrencyId: quote.toCurrencyId,
        calculationCurrencyId: quote.fromCurrencyId,
        calculationTimestamp: quote.createdAt,
        feeAmountInBaseMinor: feeAmountInBaseMinor.toString(),
        feeAmountMinor: feeAmountMinor.toString(),
        feeBps: feeBps.toString(),
        financialLines,
        fxQuoteId: quote.id,
        idempotencyKey: input.idempotencyKey,
        originalAmountMinor: originalAmountMinor.toString(),
        quoteSnapshot: serializeQuoteDetails(quoteDetails),
        rateDen: quote.rateDen.toString(),
        rateNum: quote.rateNum.toString(),
        rateSource: "fx_quote",
        totalAmountMinor: totalAmountMinor.toString(),
        totalInBaseMinor: totalInBaseMinor.toString(),
        totalWithExpensesInBaseMinor:
          totalWithExpensesInBaseMinor.toString(),
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
      const expiredQuotes = await deps.treasury.quotes.commands.expireQuotes(now);

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

    async markQuoteUsed(input: TreasuryMarkQuoteUsedInput): Promise<TreasuryQuoteRecord> {
      const dealId = input.dealId ?? null;

      if (dealId) {
        await requireCurrentAcceptedQuote({
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
