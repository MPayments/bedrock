import { canonicalJson, sha256Hex } from "@bedrock/shared/core";

// `asOf` is intentionally NOT part of the tuple — re-opening the picker on
// the same conditions must not invalidate the lock.
export interface PricingFingerprintInput {
  fromCurrencyId: string;
  toCurrencyId: string;
  fromAmountMinor: bigint | string;
  toAmountMinor: bigint | string;
  pricingMode: "auto_cross" | "explicit_route";
  routeTemplateId: string | null;
  commercialTerms: {
    agreementVersionId: string | null;
    agreementFeeBps: bigint | string;
    quoteMarkupBps: bigint | string;
    fixedFeeAmountMinor: bigint | string | null;
    fixedFeeCurrency: string | null;
  } | null;
}

export function canonicalizePricingFingerprintInput(
  input: PricingFingerprintInput,
): Record<string, unknown> {
  const commercialTerms = input.commercialTerms
    ? {
        agreementFeeBps: toDecimalString(input.commercialTerms.agreementFeeBps),
        agreementVersionId: input.commercialTerms.agreementVersionId,
        fixedFeeAmountMinor:
          input.commercialTerms.fixedFeeAmountMinor === null
            ? null
            : toDecimalString(input.commercialTerms.fixedFeeAmountMinor),
        fixedFeeCurrency: input.commercialTerms.fixedFeeCurrency,
        quoteMarkupBps: toDecimalString(input.commercialTerms.quoteMarkupBps),
      }
    : null;

  return {
    commercialTerms,
    fromAmountMinor: toDecimalString(input.fromAmountMinor),
    fromCurrencyId: input.fromCurrencyId,
    pricingMode: input.pricingMode,
    routeTemplateId: input.routeTemplateId,
    toAmountMinor: toDecimalString(input.toAmountMinor),
    toCurrencyId: input.toCurrencyId,
  };
}

export function computePricingFingerprint(
  input: PricingFingerprintInput,
): string {
  return sha256Hex(canonicalJson(canonicalizePricingFingerprintInput(input)));
}

function toDecimalString(value: bigint | string): string {
  return typeof value === "bigint" ? value.toString() : value;
}
