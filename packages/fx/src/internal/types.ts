import { schema, type FxQuote } from "@bedrock/db/schema";
import { type FeesService } from "@bedrock/fees";

export type ComputedLeg = {
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
    executionOrgId: string | null;
};

export type FxQuoteDetails = {
    quote: FxQuote;
    legs: typeof schema.fxQuoteLegs.$inferSelect[];
    feeComponents: Awaited<ReturnType<FeesService["getQuoteFeeComponents"]>>;
    pricingTrace: Record<string, unknown>;
};
