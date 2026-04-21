import type {
  DealPricingBenchmarks,
  DealPricingFormulaTrace,
  DealPricingProfitability,
} from "@bedrock/deals/contracts";
import { NotFoundError, ValidationError } from "@bedrock/shared/core/errors";
import type { QuoteRecord } from "@bedrock/treasury/contracts";
import type {
  CalculationDocumentData,
  ClientContractFormat,
  DocumentLanguage,
  GeneratedDocument,
} from "@bedrock/workflow-document-generation";

import type { AppContext } from "../../context";
import {
  feeBpsToPercentString,
  minorToDecimalString,
  rationalToDecimalString,
  serializeRateSource,
} from "./calculation-document-formatters";
import { requireDeal } from "./deal-linked-resources";

interface StoredPricingSnapshot {
  benchmarks: DealPricingBenchmarks | null;
  formulaTrace: DealPricingFormulaTrace | null;
  profitability: DealPricingProfitability | null;
}

function extractStoredPricingSnapshot(
  quote: QuoteRecord,
): StoredPricingSnapshot | null {
  if (!quote.pricingTrace || typeof quote.pricingTrace !== "object") {
    return null;
  }

  const trace = quote.pricingTrace as Record<string, unknown>;
  const metadata =
    trace.metadata && typeof trace.metadata === "object"
      ? (trace.metadata as Record<string, unknown>)
      : null;

  if (!metadata) {
    return null;
  }

  const snapshot =
    metadata.crmPricingSnapshot &&
    typeof metadata.crmPricingSnapshot === "object" &&
    !Array.isArray(metadata.crmPricingSnapshot)
      ? (metadata.crmPricingSnapshot as Record<string, unknown>)
      : null;

  if (!snapshot) {
    return null;
  }

  return {
    benchmarks:
      (snapshot.benchmarks as DealPricingBenchmarks | null | undefined) ??
      null,
    formulaTrace:
      (snapshot.formulaTrace as DealPricingFormulaTrace | null | undefined) ??
      null,
    profitability:
      (snapshot.profitability as
        | DealPricingProfitability
        | null
        | undefined) ?? null,
  };
}

export async function exportDealPricingDocument(input: {
  ctx: AppContext;
  dealId: string;
  format: ClientContractFormat;
  lang: DocumentLanguage;
  quoteId?: string | null;
}): Promise<GeneratedDocument> {
  await requireDeal(input.ctx, input.dealId);

  let targetQuoteId: string;

  if (input.quoteId) {
    targetQuoteId = input.quoteId;
  } else {
    const workflow =
      await input.ctx.dealsModule.deals.queries.findWorkflowById(input.dealId);

    if (!workflow) {
      throw new NotFoundError("Deal workflow", input.dealId);
    }

    const acceptedQuote = workflow.acceptedQuote;

    if (!acceptedQuote) {
      throw new ValidationError(
        `Deal ${input.dealId} has no accepted quote to export`,
      );
    }

    targetQuoteId = acceptedQuote.quoteId;
  }

  const quote =
    await input.ctx.treasuryModule.quotes.queries.findById(targetQuoteId);

  if (!quote) {
    throw new NotFoundError("Quote", targetQuoteId);
  }

  if (quote.dealId !== input.dealId) {
    throw new NotFoundError("Quote", targetQuoteId);
  }

  const snapshot = extractStoredPricingSnapshot(quote);
  const commercialTerms = quote.commercialTerms;
  const fixedFeeCurrencyCode = commercialTerms?.fixedFeeCurrency ?? null;

  const [fromCurrency, toCurrency, fixedFeeCurrency] = await Promise.all([
    input.ctx.currenciesService.findById(quote.fromCurrencyId),
    input.ctx.currenciesService.findById(quote.toCurrencyId),
    fixedFeeCurrencyCode
      ? input.ctx.currenciesService.findByCode(fixedFeeCurrencyCode)
      : Promise.resolve(null),
  ]);

  const agreementFeeBps = commercialTerms?.agreementFeeBps ?? 0n;
  const quoteMarkupBps = commercialTerms?.quoteMarkupBps ?? 0n;
  const totalFeeBps =
    commercialTerms?.totalFeeBps ?? agreementFeeBps + quoteMarkupBps;

  const fromAmountMinor = quote.fromAmountMinor;
  const agreementFeeAmountMinor =
    agreementFeeBps === 0n
      ? 0n
      : (fromAmountMinor * agreementFeeBps + 5000n) / 10000n;
  const quoteMarkupAmountMinor =
    quoteMarkupBps === 0n
      ? 0n
      : (fromAmountMinor * quoteMarkupBps + 5000n) / 10000n;

  const profitability = snapshot?.profitability ?? null;
  const marketBench = snapshot?.benchmarks?.market ?? null;

  const fixedFeeCurrencyPrecision =
    fixedFeeCurrency?.precision ?? fromCurrency.precision;
  const fixedFeeAmountMinor = commercialTerms?.fixedFeeAmountMinor ?? 0n;

  const fromPrecision = fromCurrency.precision;

  const calculationData: CalculationDocumentData = {
    additionalExpenses: minorToDecimalString(0n, fromPrecision),
    additionalExpensesInBase: minorToDecimalString(0n, toCurrency.precision),
    agreementFeeAmount: minorToDecimalString(
      agreementFeeAmountMinor,
      fromPrecision,
    ),
    agreementFeePercentage: feeBpsToPercentString(agreementFeeBps),
    baseCurrencyCode: toCurrency.code,
    calculationTimestamp: quote.createdAt.toISOString(),
    currencyCode: fromCurrency.code,
    finalRate: rationalToDecimalString(quote.rateNum, quote.rateDen),
    fixedFeeAmount: minorToDecimalString(
      fixedFeeAmountMinor,
      fixedFeeCurrencyPrecision,
    ),
    fixedFeeCurrencyCode,
    id: quote.id,
    originalAmount: minorToDecimalString(quote.fromAmountMinor, fromPrecision),
    quoteMarkupAmount: minorToDecimalString(
      quoteMarkupAmountMinor,
      fromPrecision,
    ),
    quoteMarkupPercentage: feeBpsToPercentString(quoteMarkupBps),
    rate: rationalToDecimalString(quote.rateNum, quote.rateDen),
    rateSource: marketBench
      ? serializeRateSource(marketBench.sourceKind)
      : "manual",
    totalAmount: profitability
      ? minorToDecimalString(profitability.customerTotalMinor, fromPrecision)
      : minorToDecimalString(quote.fromAmountMinor, fromPrecision),
    totalFeeAmount: profitability
      ? minorToDecimalString(
          profitability.commercialRevenueMinor,
          fromPrecision,
        )
      : minorToDecimalString(0n, fromPrecision),
    totalFeeAmountInBase: profitability
      ? minorToDecimalString(
          profitability.commercialRevenueMinor,
          fromPrecision,
        )
      : minorToDecimalString(0n, fromPrecision),
    totalFeePercentage: feeBpsToPercentString(totalFeeBps),
    totalInBase: profitability
      ? minorToDecimalString(profitability.customerTotalMinor, fromPrecision)
      : minorToDecimalString(quote.fromAmountMinor, fromPrecision),
    totalWithExpensesInBase: profitability
      ? minorToDecimalString(profitability.customerTotalMinor, fromPrecision)
      : minorToDecimalString(quote.fromAmountMinor, fromPrecision),
  };

  return input.ctx.documentGenerationWorkflow.generateCalculation({
    calculationData,
    format: input.format,
    lang: input.lang,
  });
}
