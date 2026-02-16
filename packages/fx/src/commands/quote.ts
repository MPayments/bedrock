import { and, eq } from "drizzle-orm";
import { schema, type FxQuote } from "@bedrock/db/schema";

import {
    NotFoundError,
    QuoteExpiredError,
} from "../errors";
import {
    type GetQuoteDetailsInput,
    type MarkQuoteUsedInput,
    type QuoteInput,
    validateGetQuoteDetailsInput,
    validateMarkQuoteUsedInput,
    validateQuoteInput,
} from "../validation";
import { type FxServiceContext } from "../internal/context";
import { effectiveRateFromAmounts, mulDivFloor } from "../internal/math";
import { resolveQuoteByRef } from "../internal/quote-ref";
import { buildAutoCrossTrace, computeExplicitRouteLegs } from "../internal/routes";
import { type FxQuoteDetails } from "../internal/types";
import { Transaction } from "@bedrock/db";

const DEFAULT_QUOTE_TTL_SECONDS = 600;

export function createQuoteHandlers(
    context: FxServiceContext,
    deps: {
        getCrossRate: (base: string, quote: string, asOf: Date, anchor?: string) => Promise<{ base: string; quote: string; rateNum: bigint; rateDen: bigint }>;
    }
) {
    const { db, feesService, log } = context;

    async function getQuoteDetails(input: GetQuoteDetailsInput): Promise<FxQuoteDetails> {
        const vaildated = validateGetQuoteDetailsInput(input);
        const quote = await resolveQuoteByRef(context, vaildated.quoteRef);

        if (!quote) throw new NotFoundError("Quote", vaildated.quoteRef);

        const legs = await db
            .select()
            .from(schema.fxQuoteLegs)
            .where(eq(schema.fxQuoteLegs.quoteId, quote.id))
            .orderBy(schema.fxQuoteLegs.idx);

        const feeComponents = await feesService.getQuoteFeeComponents({ quoteId: quote.id });
        const pricingTrace = (quote.pricingTrace ?? {}) as Record<string, unknown>;

        return { quote, legs, feeComponents, pricingTrace };
    }

    async function quote(input: QuoteInput): Promise<FxQuote> {
        const validated = validateQuoteInput(input);

        let legs = [] as ReturnType<typeof computeExplicitRouteLegs>;
        let toAmountMinor = 0n;
        let rateNum = 1n;
        let rateDen = 1n;
        let pricingTrace: Record<string, unknown>;

        if (validated.mode === "auto_cross") {
            const cross = await deps.getCrossRate(
                validated.fromCurrency,
                validated.toCurrency,
                validated.asOf,
                validated.anchor ?? "USD"
            );
            toAmountMinor = mulDivFloor(validated.fromAmountMinor, cross.rateNum, cross.rateDen);
            const effectiveRate = effectiveRateFromAmounts(validated.fromAmountMinor, toAmountMinor);
            rateNum = effectiveRate.rateNum;
            rateDen = effectiveRate.rateDen;

            legs = [{
                idx: 1,
                fromCurrency: validated.fromCurrency,
                toCurrency: validated.toCurrency,
                fromAmountMinor: validated.fromAmountMinor,
                toAmountMinor,
                rateNum,
                rateDen,
                sourceKind: "derived",
                sourceRef: validated.anchor ?? "USD",
                asOf: validated.asOf,
                executionOrgId: null,
            }];
            pricingTrace = validated.pricingTrace ?? buildAutoCrossTrace(validated, cross.rateNum, cross.rateDen);
        } else {
            legs = computeExplicitRouteLegs(validated);
            toAmountMinor = legs[legs.length - 1]!.toAmountMinor;
            const effectiveRate = effectiveRateFromAmounts(validated.fromAmountMinor, toAmountMinor);
            rateNum = effectiveRate.rateNum;
            rateDen = effectiveRate.rateDen;
            pricingTrace = validated.pricingTrace;
        }

        const feeComponents = await feesService.calculateFxQuoteFeeComponents({
            fromCurrency: validated.fromCurrency,
            toCurrency: validated.toCurrency,
            principalMinor: validated.fromAmountMinor,
            dealDirection: validated.dealDirection,
            dealForm: validated.dealForm,
            at: validated.asOf,
        });

        const ttlSeconds = validated.ttlSeconds ?? DEFAULT_QUOTE_TTL_SECONDS;
        const expiresAt = new Date(validated.asOf.getTime() + ttlSeconds * 1000);

        return db.transaction(async (tx: Transaction) => {
            const inserted = await tx
                .insert(schema.fxQuotes)
                .values({
                    fromCurrency: validated.fromCurrency,
                    toCurrency: validated.toCurrency,
                    fromAmountMinor: validated.fromAmountMinor,
                    toAmountMinor,
                    pricingMode: validated.mode,
                    pricingTrace,
                    dealDirection: validated.dealDirection ?? null,
                    dealForm: validated.dealForm ?? null,
                    rateNum,
                    rateDen,
                    expiresAt,
                    status: "active",
                    idempotencyKey: validated.idempotencyKey,
                })
                .onConflictDoNothing({
                    target: schema.fxQuotes.idempotencyKey,
                })
                .returning();

            const created = inserted[0];
            if (created) {
                await tx.insert(schema.fxQuoteLegs).values(
                    legs.map((leg) => ({
                        quoteId: created.id,
                        idx: leg.idx,
                        fromCurrency: leg.fromCurrency,
                        toCurrency: leg.toCurrency,
                        fromAmountMinor: leg.fromAmountMinor,
                        toAmountMinor: leg.toAmountMinor,
                        rateNum: leg.rateNum,
                        rateDen: leg.rateDen,
                        sourceKind: leg.sourceKind,
                        sourceRef: leg.sourceRef,
                        asOf: leg.asOf,
                        executionOrgId: leg.executionOrgId,
                    }))
                );

                await feesService.saveQuoteFeeComponents({
                    quoteId: created.id,
                    components: feeComponents,
                }, tx);

                log?.info("FX quote created", {
                    quoteId: created.id,
                    mode: validated.mode,
                    legs: legs.length,
                    feeComponents: feeComponents.length,
                });
                return created;
            }

            const [racedExisting] = await tx
                .select()
                .from(schema.fxQuotes)
                .where(eq(schema.fxQuotes.idempotencyKey, validated.idempotencyKey))
                .limit(1);

            if (!racedExisting) {
                throw new Error(`Quote insert conflict without existing idempotency row: ${validated.idempotencyKey}`);
            }

            return racedExisting;
        });
    }

    async function markQuoteUsed(input: MarkQuoteUsedInput): Promise<FxQuote> {
        const validated = validateMarkQuoteUsedInput(input);

        const [quoteRow] = await db
            .select()
            .from(schema.fxQuotes)
            .where(eq(schema.fxQuotes.id, validated.quoteId))
            .limit(1);

        if (!quoteRow) {
            throw new NotFoundError("Quote", validated.quoteId);
        }

        if (quoteRow.status !== "active") {
            return quoteRow;
        }

        if (quoteRow.expiresAt.getTime() < validated.at.getTime()) {
            throw new QuoteExpiredError("Quote expired");
        }

        const updated = await db
            .update(schema.fxQuotes)
            .set({
                status: "used",
                usedByRef: validated.usedByRef,
                usedAt: validated.at,
            })
            .where(and(
                eq(schema.fxQuotes.id, validated.quoteId),
                eq(schema.fxQuotes.status, "active")
            ))
            .returning();

        return updated[0] ?? quoteRow;
    }

    return {
        quote,
        getQuoteDetails,
        markQuoteUsed,
    };
}
