import { BPS_SCALE, mulDivRoundHalfUp, toMinorAmountString } from "@bedrock/shared/money";

import type { FeeComponent } from "../../fees/domain/fee-types";

export interface QuoteCommercialTermsSnapshot {
  agreementVersionId: string | null;
  agreementFeeBps: bigint;
  quoteMarkupBps: bigint;
  totalFeeBps: bigint;
  fixedFeeAmountMinor: bigint | null;
  fixedFeeCurrency: string | null;
}

export interface SerializedQuoteCommercialTerms {
  agreementVersionId: string | null;
  agreementFeeBps: string;
  quoteMarkupBps: string;
  totalFeeBps: string;
  fixedFeeAmountMinor: string | null;
  fixedFeeCurrency: string | null;
}

export function serializeQuoteCommercialTerms(
  terms: QuoteCommercialTermsSnapshot | null,
): SerializedQuoteCommercialTerms | null {
  if (!terms) {
    return null;
  }

  return {
    agreementVersionId: terms.agreementVersionId,
    agreementFeeBps: terms.agreementFeeBps.toString(),
    quoteMarkupBps: terms.quoteMarkupBps.toString(),
    totalFeeBps: terms.totalFeeBps.toString(),
    fixedFeeAmountMinor: terms.fixedFeeAmountMinor?.toString() ?? null,
    fixedFeeCurrency: terms.fixedFeeCurrency,
  };
}

export function deserializeQuoteCommercialTerms(
  terms: SerializedQuoteCommercialTerms | null | undefined,
): QuoteCommercialTermsSnapshot | null {
  if (!terms) {
    return null;
  }

  return {
    agreementVersionId: terms.agreementVersionId,
    agreementFeeBps: BigInt(terms.agreementFeeBps),
    quoteMarkupBps: BigInt(terms.quoteMarkupBps),
    totalFeeBps: BigInt(terms.totalFeeBps),
    fixedFeeAmountMinor:
      terms.fixedFeeAmountMinor === null ? null : BigInt(terms.fixedFeeAmountMinor),
    fixedFeeCurrency: terms.fixedFeeCurrency,
  };
}

export function createQuoteCommercialTerms(input: {
  agreementVersionId?: string | null;
  agreementFeeBps?: bigint;
  quoteMarkupBps?: bigint;
  fixedFeeAmount?: string | null;
  fixedFeeCurrency?: string | null;
}): QuoteCommercialTermsSnapshot {
  const agreementFeeBps = input.agreementFeeBps ?? 0n;
  const quoteMarkupBps = input.quoteMarkupBps ?? 0n;
  const fixedFeeCurrency = input.fixedFeeCurrency?.trim().toUpperCase() ?? null;
  const fixedFeeAmount =
    input.fixedFeeAmount?.trim().replace(",", ".") ?? null;
  const fixedFeeAmountMinor =
    fixedFeeAmount && fixedFeeCurrency
      ? BigInt(toMinorAmountString(fixedFeeAmount, fixedFeeCurrency))
      : null;

  return {
    agreementVersionId: input.agreementVersionId ?? null,
    agreementFeeBps,
    quoteMarkupBps,
    totalFeeBps: agreementFeeBps + quoteMarkupBps,
    fixedFeeAmountMinor,
    fixedFeeCurrency:
      fixedFeeAmountMinor !== null && fixedFeeCurrency ? fixedFeeCurrency : null,
  };
}

function calculateCommercialFeeAmountMinor(
  amountMinor: bigint,
  bps: bigint,
): bigint {
  if (amountMinor === 0n || bps === 0n) {
    return 0n;
  }

  return mulDivRoundHalfUp(amountMinor, bps, BPS_SCALE);
}

export function buildCommercialFeeComponents(input: {
  commercialTerms: QuoteCommercialTermsSnapshot;
  feeCurrency: string;
  principalMinor: bigint;
}): FeeComponent[] {
  const components: FeeComponent[] = [];
  const agreementFeeAmountMinor = calculateCommercialFeeAmountMinor(
    input.principalMinor,
    input.commercialTerms.agreementFeeBps,
  );
  const quoteMarkupAmountMinor = calculateCommercialFeeAmountMinor(
    input.principalMinor,
    input.commercialTerms.quoteMarkupBps,
  );

  if (agreementFeeAmountMinor > 0n) {
    components.push({
      id: `commercial:agreement_fee:${input.commercialTerms.agreementVersionId ?? "none"}`,
      kind: "agreement_fee",
      currency: input.feeCurrency,
      amountMinor: agreementFeeAmountMinor,
      source: "manual",
      settlementMode: "in_ledger",
      accountingTreatment: "income",
      memo: "Agreement fee",
      metadata: {
        commercialComponent: "agreement_fee",
        ...(input.commercialTerms.agreementVersionId
          ? { agreementVersionId: input.commercialTerms.agreementVersionId }
          : {}),
      },
    });
  }

  if (quoteMarkupAmountMinor > 0n) {
    components.push({
      id: "commercial:quote_markup",
      kind: "quote_markup",
      currency: input.feeCurrency,
      amountMinor: quoteMarkupAmountMinor,
      source: "manual",
      settlementMode: "in_ledger",
      accountingTreatment: "income",
      memo: "Quote markup",
      metadata: {
        commercialComponent: "quote_markup",
      },
    });
  }

  if (
    input.commercialTerms.fixedFeeAmountMinor !== null &&
    input.commercialTerms.fixedFeeAmountMinor > 0n &&
    input.commercialTerms.fixedFeeCurrency
  ) {
    components.push({
      id: "commercial:fixed_fee",
      kind: "agreement_fixed_fee",
      currency: input.commercialTerms.fixedFeeCurrency,
      amountMinor: input.commercialTerms.fixedFeeAmountMinor,
      source: "manual",
      settlementMode: "in_ledger",
      accountingTreatment: "income",
      memo: "Fixed fee",
      metadata: {
        commercialComponent: "fixed_fee",
      },
    });
  }

  return components;
}
