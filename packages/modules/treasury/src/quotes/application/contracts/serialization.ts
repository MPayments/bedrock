import { minorToAmountString } from "@bedrock/shared/money";

import type {
  Quote,
  QuoteDetailsRecord,
  QuoteDetailsResponse,
  QuoteListItem,
  QuotePreviewRecord,
  QuotePreviewResponse,
  QuoteRecord,
} from "../../../contracts";

type QuoteDealRef = NonNullable<Quote["dealRef"]>;

export function serializeQuote(
  quote: QuoteRecord,
  dealRef: QuoteDealRef | null = null,
): Quote {
  return {
    id: quote.id,
    fromCurrencyId: quote.fromCurrencyId,
    toCurrencyId: quote.toCurrencyId,
    fromCurrency: quote.fromCurrency ?? "",
    toCurrency: quote.toCurrency ?? "",
    fromAmountMinor: quote.fromAmountMinor.toString(),
    toAmountMinor: quote.toAmountMinor.toString(),
    pricingMode: quote.pricingMode,
    pricingTrace: quote.pricingTrace ?? {},
    commercialTerms: quote.commercialTerms
      ? {
          agreementVersionId: quote.commercialTerms.agreementVersionId,
          agreementFeeBps: quote.commercialTerms.agreementFeeBps.toString(),
          quoteMarkupBps: quote.commercialTerms.quoteMarkupBps.toString(),
          totalFeeBps: quote.commercialTerms.totalFeeBps.toString(),
          fixedFeeAmountMinor:
            quote.commercialTerms.fixedFeeAmountMinor?.toString() ?? null,
          fixedFeeCurrency: quote.commercialTerms.fixedFeeCurrency ?? null,
        }
      : null,
    dealDirection: quote.dealDirection ?? null,
    dealForm: quote.dealForm ?? null,
    rateNum: quote.rateNum.toString(),
    rateDen: quote.rateDen.toString(),
    status: quote.status,
    dealId: quote.dealId ?? null,
    usedByRef: quote.usedByRef ?? null,
    usedDocumentId: quote.usedDocumentId ?? null,
    usedAt: quote.usedAt?.toISOString() ?? null,
    expiresAt: quote.expiresAt.toISOString(),
    idempotencyKey: quote.idempotencyKey,
    createdAt: quote.createdAt.toISOString(),
    dealRef,
  };
}

export function serializeQuoteListItem(
  quote: QuoteRecord,
  dealRef: QuoteDealRef | null = null,
): QuoteListItem {
  return {
    ...serializeQuote(quote, dealRef),
    fromAmount: minorToAmountString(quote.fromAmountMinor, {
      currency: quote.fromCurrency ?? "",
    }),
    toAmount: minorToAmountString(quote.toAmountMinor, {
      currency: quote.toCurrency ?? "",
    }),
  };
}

export function serializeQuoteDetails(
  details: QuoteDetailsRecord,
  dealRef: QuoteDealRef | null = null,
): QuoteDetailsResponse {
  return {
    quote: serializeQuote(details.quote, dealRef),
    legs: details.legs.map((leg) => ({
      id: leg.id,
      quoteId: leg.quoteId,
      idx: leg.idx,
      fromCurrencyId: leg.fromCurrencyId,
      toCurrencyId: leg.toCurrencyId,
      fromCurrency: leg.fromCurrency ?? "",
      toCurrency: leg.toCurrency ?? "",
      fromAmountMinor: leg.fromAmountMinor.toString(),
      toAmountMinor: leg.toAmountMinor.toString(),
      rateNum: leg.rateNum.toString(),
      rateDen: leg.rateDen.toString(),
      sourceKind: leg.sourceKind,
      sourceRef: leg.sourceRef ?? null,
      asOf: leg.asOf.toISOString(),
      executionCounterpartyId: leg.executionCounterpartyId ?? null,
      createdAt: leg.createdAt.toISOString(),
    })),
    feeComponents: details.feeComponents.map((component) => ({
      ...component,
      amountMinor: component.amountMinor.toString(),
    })),
    financialLines: details.financialLines.map((line) => ({
      ...line,
      amountMinor: line.amountMinor.toString(),
    })),
    pricingTrace: details.pricingTrace,
    commercialTerms: details.quote.commercialTerms
      ? {
          agreementVersionId: details.quote.commercialTerms.agreementVersionId,
          agreementFeeBps:
            details.quote.commercialTerms.agreementFeeBps.toString(),
          quoteMarkupBps:
            details.quote.commercialTerms.quoteMarkupBps.toString(),
          totalFeeBps: details.quote.commercialTerms.totalFeeBps.toString(),
          fixedFeeAmountMinor:
            details.quote.commercialTerms.fixedFeeAmountMinor?.toString() ?? null,
          fixedFeeCurrency:
            details.quote.commercialTerms.fixedFeeCurrency ?? null,
        }
      : null,
  };
}

export function serializeQuotePreview(
  preview: QuotePreviewRecord,
): QuotePreviewResponse {
  return {
    fromCurrency: preview.fromCurrency,
    toCurrency: preview.toCurrency,
    fromAmountMinor: preview.fromAmountMinor.toString(),
    toAmountMinor: preview.toAmountMinor.toString(),
    fromAmount: minorToAmountString(preview.fromAmountMinor, {
      currency: preview.fromCurrency,
    }),
    toAmount: minorToAmountString(preview.toAmountMinor, {
      currency: preview.toCurrency,
    }),
    pricingMode: preview.pricingMode,
    pricingTrace: preview.pricingTrace,
    commercialTerms: preview.commercialTerms
      ? {
          agreementVersionId: preview.commercialTerms.agreementVersionId,
          agreementFeeBps: preview.commercialTerms.agreementFeeBps.toString(),
          quoteMarkupBps: preview.commercialTerms.quoteMarkupBps.toString(),
          totalFeeBps: preview.commercialTerms.totalFeeBps.toString(),
          fixedFeeAmountMinor:
            preview.commercialTerms.fixedFeeAmountMinor?.toString() ?? null,
          fixedFeeCurrency: preview.commercialTerms.fixedFeeCurrency ?? null,
        }
      : null,
    dealDirection: preview.dealDirection,
    dealForm: preview.dealForm,
    rateNum: preview.rateNum.toString(),
    rateDen: preview.rateDen.toString(),
    expiresAt: preview.expiresAt.toISOString(),
    legs: preview.legs.map((leg) => ({
      idx: leg.idx,
      fromCurrency: leg.fromCurrency,
      toCurrency: leg.toCurrency,
      fromAmountMinor: leg.fromAmountMinor.toString(),
      toAmountMinor: leg.toAmountMinor.toString(),
      rateNum: leg.rateNum.toString(),
      rateDen: leg.rateDen.toString(),
      sourceKind: leg.sourceKind,
      sourceRef: leg.sourceRef ?? null,
      asOf: leg.asOf.toISOString(),
      executionCounterpartyId: leg.executionCounterpartyId ?? null,
    })),
    feeComponents: preview.feeComponents.map((component) => ({
      ...component,
      amountMinor: component.amountMinor.toString(),
    })),
    financialLines: preview.financialLines.map((line) => ({
      ...line,
      amountMinor: line.amountMinor.toString(),
    })),
  };
}
