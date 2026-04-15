import type { AgreementsModule } from "@bedrock/agreements";
import type { CalculationsModule } from "@bedrock/calculations";
import type { CurrenciesService } from "@bedrock/currencies";
import {
  DealNotFoundError,
  DealQuoteInactiveError,
  DealQuoteNotAcceptedError,
  type DealsModule,
} from "@bedrock/deals";
import { ValidationError } from "@bedrock/shared/core/errors";
import { mulDivRoundHalfUp } from "@bedrock/shared/money";
import type { TreasuryModule } from "@bedrock/treasury";

import {
  calculatePercentAmountMinorHalfUp,
} from "./commercial-pricing";
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
  agreements: Pick<AgreementsModule, "agreements">;
  calculations: Pick<CalculationsModule, "calculations">;
  currencies: Pick<CurrenciesService, "findByCode" | "findById">;
  deals: Pick<DealsModule, "deals">;
  treasury: Pick<TreasuryModule, "quotes">;
}

function convertQuoteComponentToBaseMinorHalfUp(input: {
  amountMinor: bigint;
  quote: Awaited<
    ReturnType<TreasuryModule["quotes"]["queries"]["getQuoteDetails"]>
  >["quote"];
}) {
  // Standalone derived components are converted and rounded per component.
  return mulDivRoundHalfUp(
    input.amountMinor,
    input.quote.rateNum,
    input.quote.rateDen,
  );
}

function resolveAdditionalExpensesInBaseMinor(input: {
  amountMinor: bigint;
  currencyCode: string;
  quote: Awaited<
    ReturnType<TreasuryModule["quotes"]["queries"]["getQuoteDetails"]>
  >["quote"];
}) {
  if (input.amountMinor === 0n) {
    return {
      additionalExpensesAmountMinor: 0n,
      additionalExpensesCurrencyId: null,
      additionalExpensesInBaseMinor: 0n,
      additionalExpensesRateDen: null,
      additionalExpensesRateNum: null,
      additionalExpensesRateSource: null,
      calculationLineCurrencyId: null,
    };
  }

  if (input.currencyCode === input.quote.toCurrency) {
    return {
      additionalExpensesAmountMinor: input.amountMinor,
      additionalExpensesCurrencyId: input.quote.toCurrencyId,
      additionalExpensesInBaseMinor: input.amountMinor,
      additionalExpensesRateDen: null,
      additionalExpensesRateNum: null,
      additionalExpensesRateSource: null,
      calculationLineCurrencyId: input.quote.toCurrencyId,
    };
  }

  if (input.currencyCode === input.quote.fromCurrency) {
    return {
      additionalExpensesAmountMinor: input.amountMinor,
      additionalExpensesCurrencyId: input.quote.fromCurrencyId,
      additionalExpensesInBaseMinor: convertQuoteComponentToBaseMinorHalfUp({
        amountMinor: input.amountMinor,
        quote: input.quote,
      }),
      additionalExpensesRateDen: input.quote.rateDen.toString(),
      additionalExpensesRateNum: input.quote.rateNum.toString(),
      additionalExpensesRateSource: "fx_quote" as const,
      calculationLineCurrencyId: input.quote.fromCurrencyId,
    };
  }

  throw new ValidationError(
    `Additional expenses currency ${input.currencyCode} is unsupported for quote ${input.quote.id}`,
  );
}

function mapQuoteLineClassification(input: {
  bucket:
    | "adjustment"
    | "fee_revenue"
    | "pass_through"
    | "provider_fee_expense"
    | "spread_revenue";
}) {
  switch (input.bucket) {
    case "fee_revenue":
    case "spread_revenue":
      return "revenue" as const;
    case "provider_fee_expense":
      return "expense" as const;
    case "pass_through":
      return "pass_through" as const;
    case "adjustment":
      return "adjustment" as const;
  }
}

async function requireCurrentAcceptedQuote(input: {
  allowUsedDocumentId?: string | null;
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
      const currentRoute =
        await deps.deals.deals.queries.findCurrentRouteByDealId(input.dealId);

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
      if (quote.commercialTerms?.fixedFeeCurrency) {
        currencyCodes.add(quote.commercialTerms.fixedFeeCurrency);
      }
      const currencies = await Promise.all(
        Array.from(currencyCodes).map((code) => deps.currencies.findByCode(code)),
      );
      const currencyIdByCode = new Map(
        currencies.map((currency) => [currency.code, currency.id]),
      );

      const quoteAdditionalExpensesByCurrency = quoteDetails.financialLines.reduce(
        (totals, line) => {
          if (line.bucket !== "pass_through") {
            return totals;
          }

          totals.set(
            line.currency,
            (totals.get(line.currency) ?? 0n) + line.amountMinor,
          );

          return totals;
        },
        new Map<string, bigint>(),
      );

      for (const amountMinor of quoteAdditionalExpensesByCurrency.values()) {
        if (amountMinor < 0n) {
          throw new ValidationError(
            `Quote ${quote.id} has negative pass_through total`,
          );
        }
      }

      const originalAmountMinor = quote.fromAmountMinor;
      const acceptedAgreementVersionId =
        workflow.acceptedQuote?.agreementVersionId ?? null;
      const commercialTerms = quote.commercialTerms ?? {
        agreementVersionId: acceptedAgreementVersionId,
        agreementFeeBps: 0n,
        quoteMarkupBps: 0n,
        totalFeeBps: 0n,
        fixedFeeAmountMinor: null,
        fixedFeeCurrency: null,
      };

      if (
        acceptedAgreementVersionId &&
        commercialTerms.agreementVersionId &&
        acceptedAgreementVersionId !== commercialTerms.agreementVersionId
      ) {
        throw new ValidationError(
          `Accepted quote ${quote.id} agreementVersionId does not match commercial terms`,
        );
      }

      const agreementVersionId =
        acceptedAgreementVersionId ?? commercialTerms.agreementVersionId ?? null;
      const agreementFeeAmountMinor = calculatePercentAmountMinorHalfUp(
        originalAmountMinor,
        commercialTerms.agreementFeeBps,
      );
      const quoteMarkupAmountMinor = calculatePercentAmountMinorHalfUp(
        originalAmountMinor,
        commercialTerms.quoteMarkupBps,
      );
      const totalFeeAmountMinor = agreementFeeAmountMinor + quoteMarkupAmountMinor;
      const totalAmountMinor = originalAmountMinor + totalFeeAmountMinor;
      const totalFeeAmountInBaseMinor = convertQuoteComponentToBaseMinorHalfUp({
        amountMinor: totalFeeAmountMinor,
        quote,
      });
      const totalInBaseMinor = quote.toAmountMinor;
      const fixedFeeAmountMinor = commercialTerms.fixedFeeAmountMinor ?? 0n;
      const fixedFeeCurrencyId =
        commercialTerms.fixedFeeCurrency
          ? (currencyIdByCode.get(commercialTerms.fixedFeeCurrency) ?? null)
          : null;

      const nonZeroAdditionalExpenses = Array.from(
        quoteAdditionalExpensesByCurrency.entries(),
      ).filter(([, amountMinor]) => amountMinor !== 0n);

      if (nonZeroAdditionalExpenses.length > 1) {
        throw new ValidationError(
          "Additional expenses must use a single currency when creating a calculation from quote",
        );
      }

      const additionalExpenses =
        nonZeroAdditionalExpenses.length === 0
          ? {
              additionalExpensesAmountMinor: 0n,
              additionalExpensesCurrencyId: null,
              additionalExpensesInBaseMinor: 0n,
              additionalExpensesRateDen: null,
              additionalExpensesRateNum: null,
              additionalExpensesRateSource: null,
            }
          : resolveAdditionalExpensesInBaseMinor({
              amountMinor: nonZeroAdditionalExpenses[0]![1],
              currencyCode: nonZeroAdditionalExpenses[0]![0],
              quote,
            });
      const additionalExpensesAmountMinor =
        additionalExpenses.additionalExpensesAmountMinor;
      const additionalExpensesCurrencyId =
        additionalExpenses.additionalExpensesCurrencyId;
      const additionalExpensesInBaseMinor =
        additionalExpenses.additionalExpensesInBaseMinor;
      const totalWithExpensesInBaseMinor =
        totalInBaseMinor +
        totalFeeAmountInBaseMinor +
        additionalExpensesInBaseMinor;

      const financialLines = quoteDetails.financialLines
        .filter((line) => line.amountMinor !== 0n)
        .map((line) => {
          const currencyId = currencyIdByCode.get(line.currency);
          if (!currencyId) {
            throw new ValidationError(`Currency ${line.currency} is not configured`);
          }

          return {
            classification: mapQuoteLineClassification({
              bucket: line.bucket,
            }),
            componentCode: line.id,
            componentFamily: line.bucket,
            kind: line.bucket,
            currencyId,
            amountMinor: line.amountMinor.toString(),
            dealId: input.dealId,
            routeVersionId: currentRoute?.id ?? null,
            sourceKind: "quote" as const,
          };
        });

      const calculation = await deps.calculations.calculations.commands.create({
        actorUserId: input.actorUserId,
        additionalExpensesAmountMinor:
          additionalExpensesAmountMinor.toString(),
        additionalExpensesCurrencyId,
        additionalExpensesInBaseMinor:
          additionalExpensesInBaseMinor.toString(),
        additionalExpensesRateDen: additionalExpenses.additionalExpensesRateDen,
        additionalExpensesRateNum: additionalExpenses.additionalExpensesRateNum,
        additionalExpensesRateSource:
          additionalExpenses.additionalExpensesRateSource,
        agreementFeeAmountMinor: agreementFeeAmountMinor.toString(),
        agreementFeeBps: commercialTerms.agreementFeeBps.toString(),
        agreementVersionId,
        baseCurrencyId: quote.toCurrencyId,
        calculationCurrencyId: quote.fromCurrencyId,
        calculationTimestamp: quote.createdAt,
        dealId: input.dealId,
        dealSnapshot: {
          acceptedQuote: workflow.acceptedQuote,
          intake: workflow.intake,
          participants: workflow.participants,
          revision: workflow.revision,
          summary: workflow.summary,
        },
        fixedFeeAmountMinor: fixedFeeAmountMinor.toString(),
        fixedFeeCurrencyId,
        financialLines,
        fxQuoteId: quote.id,
        idempotencyKey: input.idempotencyKey,
        originalAmountMinor: originalAmountMinor.toString(),
        pricingProvenance: {
          source: "accepted_quote",
          acceptedAgreementVersionId,
          quoteCommercialTerms: {
            agreementVersionId: commercialTerms.agreementVersionId,
            agreementFeeBps: commercialTerms.agreementFeeBps.toString(),
            quoteMarkupBps: commercialTerms.quoteMarkupBps.toString(),
            totalFeeBps: commercialTerms.totalFeeBps.toString(),
            fixedFeeAmountMinor:
              commercialTerms.fixedFeeAmountMinor?.toString() ?? null,
            fixedFeeCurrency: commercialTerms.fixedFeeCurrency ?? null,
          },
          quoteId: quote.id,
          routeVersionId: currentRoute?.id ?? null,
        },
        quoteMarkupAmountMinor: quoteMarkupAmountMinor.toString(),
        quoteMarkupBps: commercialTerms.quoteMarkupBps.toString(),
        quoteSnapshot: serializeQuoteDetails(quoteDetails),
        routeSnapshot: currentRoute,
        routeVersionId: currentRoute?.id ?? null,
        referenceRateAsOf: null,
        referenceRateDen: null,
        referenceRateNum: null,
        referenceRateSource: null,
        rateDen: quote.rateDen.toString(),
        rateNum: quote.rateNum.toString(),
        rateSource: "fx_quote",
        state: "accepted",
        totalAmountMinor: totalAmountMinor.toString(),
        totalFeeAmountInBaseMinor: totalFeeAmountInBaseMinor.toString(),
        totalFeeAmountMinor: totalFeeAmountMinor.toString(),
        totalFeeBps: commercialTerms.totalFeeBps.toString(),
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
