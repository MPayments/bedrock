import type { FinancialLine } from "@bedrock/documents/financial-lines";
import type { FxQuote, FxQuoteLeg } from "@bedrock/fx/schema";

import type { FxQuoteFeePort } from "../ports";

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
    feeComponents: Awaited<ReturnType<FxQuoteFeePort["getQuoteFeeComponents"]>>;
    financialLines: FinancialLine[];
    pricingTrace: Record<string, unknown>;
}
