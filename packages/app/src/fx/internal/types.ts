import { type FeesService } from "@bedrock/app/fees";
import type { FxQuote, FxQuoteLeg } from "@bedrock/app/fx/schema";

export interface ComputedLeg {
    idx: number;
    fromCurrency: string;
    toCurrency: string;
    fromAmountMinor: bigint;
    toAmountMinor: bigint;
    rateNum: bigint;
    rateDen: bigint;
    sourceKind: "cb" | "bank" | "manual" | "derived" | "market";
    sourceRef: string | null;
    asOf: Date;
    executionCounterpartyId: string | null;
}

export interface FxQuoteDetails {
    quote: FxQuote;
    legs: FxQuoteLeg[];
    feeComponents: Awaited<ReturnType<FeesService["getQuoteFeeComponents"]>>;
    pricingTrace: Record<string, unknown>;
}
