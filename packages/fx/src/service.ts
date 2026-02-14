import { and, desc, eq, sql } from "drizzle-orm";
import { schema, type FxQuote } from "@bedrock/db/schema";
import { type Database } from "@bedrock/db";
import { type Logger, normalizeCurrency } from "@bedrock/kernel";
import { type FeesService } from "@bedrock/fees";
import { BPS_SCALE } from "@bedrock/kernel/constants";
import {
    QuoteExpiredError,
    RateNotFoundError,
    NotFoundError,
    PolicyNotFoundError,
    ValidationError,
} from "./errors";
import {
    validateUpsertPolicyInput,
    validateSetManualRateInput,
    validateQuoteInput,
    validateMarkQuoteUsedInput,
    validateGetQuoteDetailsInput,
    type UpsertPolicyInput,
    type SetManualRateInput,
    type QuoteInput,
    type MarkQuoteUsedInput,
    type GetQuoteDetailsInput,
} from "./validation";

function mulDivFloor(a: bigint, num: bigint, den: bigint): bigint {
    if (den <= 0n) throw new Error("rateDen must be > 0");
    return (a * num) / den;
}

function gcd(a: bigint, b: bigint): bigint {
    let x = a < 0n ? -a : a;
    let y = b < 0n ? -b : b;
    while (y !== 0n) {
        const t = y;
        y = x % y;
        x = t;
    }
    return x;
}

type ComputedLeg = {
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

export type FxService = ReturnType<typeof createFxService>;

type FxServiceDeps = {
    db: Database;
    feesService: FeesService;
    logger?: Logger;
};

export type FxQuoteDetails = {
    quote: FxQuote;
    legs: typeof schema.fxQuoteLegs.$inferSelect[];
    feeComponents: Awaited<ReturnType<FeesService["getQuoteFeeComponents"]>>;
    pricingTrace: Record<string, unknown>;
};

export function createFxService(deps: FxServiceDeps) {
    const { db, feesService, logger } = deps;
    const log = logger?.child({ svc: "fx" });

    function isUuidLike(value: string): boolean {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
    }

    async function resolveQuoteByRef(quoteRef: string): Promise<FxQuote | undefined> {
        if (isUuidLike(quoteRef)) {
            const [byId] = await db
                .select()
                .from(schema.fxQuotes)
                .where(eq(schema.fxQuotes.id, quoteRef))
                .limit(1);
            const [byIdempotency] = await db
                .select()
                .from(schema.fxQuotes)
                .where(eq(schema.fxQuotes.idempotencyKey, quoteRef))
                .limit(1);

            if (byId && byIdempotency && byId.id !== byIdempotency.id) {
                throw new ValidationError(`quoteRef ${quoteRef} is ambiguous between quote ID and idempotency key`);
            }

            return byId ?? byIdempotency;
        }

        const [byIdempotency] = await db
            .select()
            .from(schema.fxQuotes)
            .where(eq(schema.fxQuotes.idempotencyKey, quoteRef))
            .limit(1);
        return byIdempotency;
    }

    async function upsertPolicy(input: UpsertPolicyInput) {
        const validated = validateUpsertPolicyInput(input);

        const upserted = await db
            .insert(schema.fxPolicies)
            .values({
                name: validated.name,
                marginBps: validated.marginBps,
                feeBps: validated.feeBps,
                ttlSeconds: validated.ttlSeconds,
            })
            .onConflictDoUpdate({
                target: schema.fxPolicies.name,
                set: {
                    marginBps: validated.marginBps,
                    feeBps: validated.feeBps,
                    ttlSeconds: validated.ttlSeconds,
                    isActive: true,
                },
            })
            .returning({ id: schema.fxPolicies.id });

        return upserted[0]!.id;
    }

    async function setManualRate(input: SetManualRateInput) {
        const validated = validateSetManualRateInput(input);

        await db.insert(schema.fxRates).values({
            base: validated.base,
            quote: validated.quote,
            rateNum: validated.rateNum,
            rateDen: validated.rateDen,
            asOf: validated.asOf,
            source: validated.source ?? "manual",
        });
    }

    async function getLatestRate(base: string, quote: string, asOf: Date) {
        base = normalizeCurrency(base);
        quote = normalizeCurrency(quote);

        const rows = await db
            .select()
            .from(schema.fxRates)
            .where(and(eq(schema.fxRates.base, base), eq(schema.fxRates.quote, quote), sql`${schema.fxRates.asOf} <= ${asOf}`))
            .orderBy(desc(schema.fxRates.asOf))
            .limit(1);

        if (!rows.length) throw new RateNotFoundError(`Rate not found for ${base}/${quote} asOf=${asOf.toISOString()}`);
        return rows[0]!;
    }

    async function getCrossRate(base: string, quote: string, asOf: Date, anchor = "USD") {
        base = normalizeCurrency(base);
        quote = normalizeCurrency(quote);
        anchor = normalizeCurrency(anchor);

        if (base === quote) {
            return {
                base,
                quote,
                rateNum: 1n,
                rateDen: 1n,
            };
        }

        try {
            const r = await getLatestRate(base, quote, asOf);
            return { base, quote, rateNum: r.rateNum, rateDen: r.rateDen };
        } catch { }

        try {
            const r = await getLatestRate(quote, base, asOf);
            return { base, quote, rateNum: r.rateDen, rateDen: r.rateNum };
        } catch { }

        if (base === anchor || quote === anchor) {
            throw new RateNotFoundError(`No direct/inverse rate for ${base}/${quote} and anchor path not possible`);
        }

        const a = await getLatestRate(base, anchor, asOf).catch(async () => {
            const inv = await getLatestRate(anchor, base, asOf);
            return { rateNum: inv.rateDen, rateDen: inv.rateNum };
        });

        const b = await getLatestRate(anchor, quote, asOf).catch(async () => {
            const inv = await getLatestRate(quote, anchor, asOf);
            return { rateNum: inv.rateDen, rateDen: inv.rateNum };
        });

        return {
            base,
            quote,
            rateNum: a.rateNum * b.rateNum,
            rateDen: a.rateDen * b.rateDen,
        };
    }

    function buildAutoCrossTrace(input: QuoteInput & { mode: "auto_cross"; anchor?: string }, rateNum: bigint, rateDen: bigint) {
        return {
            version: "v1",
            mode: "auto_cross",
            anchor: input.anchor ?? "USD",
            summary: `${input.fromCurrency}/${input.toCurrency} cross quote`,
            steps: [
                {
                    type: "cross_rate",
                    fromCurrency: input.fromCurrency,
                    toCurrency: input.toCurrency,
                    rateNum: rateNum.toString(),
                    rateDen: rateDen.toString(),
                    asOf: input.asOf.toISOString(),
                },
            ],
        } as Record<string, unknown>;
    }

    function computeExplicitRouteLegs(input: QuoteInput & { mode: "explicit_route" }): ComputedLeg[] {
        if (input.legs[0]!.fromCurrency !== input.fromCurrency) {
            throw new ValidationError("First leg fromCurrency must match quote fromCurrency");
        }
        if (input.legs[input.legs.length - 1]!.toCurrency !== input.toCurrency) {
            throw new ValidationError("Last leg toCurrency must match quote toCurrency");
        }

        let rollingAmount = input.fromAmountMinor;
        const result: ComputedLeg[] = [];

        for (let idx = 0; idx < input.legs.length; idx++) {
            const leg = input.legs[idx]!;
            if (idx > 0) {
                const prev = input.legs[idx - 1]!;
                if (prev.toCurrency !== leg.fromCurrency) {
                    throw new ValidationError(
                        `Leg continuity mismatch at idx=${idx + 1}: ${prev.toCurrency} != ${leg.fromCurrency}`
                    );
                }
            }

            const toAmountMinor = mulDivFloor(rollingAmount, leg.rateNum, leg.rateDen);
            if (toAmountMinor <= 0n) {
                throw new ValidationError(`Computed leg toAmountMinor must be positive at idx=${idx + 1}`);
            }

            result.push({
                idx: idx + 1,
                fromCurrency: leg.fromCurrency,
                toCurrency: leg.toCurrency,
                fromAmountMinor: rollingAmount,
                toAmountMinor,
                rateNum: leg.rateNum,
                rateDen: leg.rateDen,
                sourceKind: leg.sourceKind,
                sourceRef: leg.sourceRef ?? null,
                asOf: leg.asOf ?? input.asOf,
                executionOrgId: leg.executionOrgId ?? null,
            });

            rollingAmount = toAmountMinor;
        }

        return result;
    }

    function effectiveRateFromAmounts(fromAmountMinor: bigint, toAmountMinor: bigint): { rateNum: bigint; rateDen: bigint } {
        const d = gcd(toAmountMinor, fromAmountMinor);
        return {
            rateNum: toAmountMinor / d,
            rateDen: fromAmountMinor / d,
        };
    }

    async function getQuoteDetails(rawInput: GetQuoteDetailsInput): Promise<FxQuoteDetails> {
        const input = validateGetQuoteDetailsInput(rawInput);
        const quote = await resolveQuoteByRef(input.quoteRef);

        if (!quote) throw new NotFoundError("Quote", input.quoteRef);

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

        const [policy] = await db
            .select()
            .from(schema.fxPolicies)
            .where(eq(schema.fxPolicies.id, validated.policyId))
            .limit(1);

        if (!policy || !policy.isActive) {
            throw new PolicyNotFoundError(validated.policyId);
        }

        let legs: ComputedLeg[] = [];
        let toAmountMinor = 0n;
        let rateNum = 1n;
        let rateDen = 1n;
        let pricingTrace: Record<string, unknown>;

        if (validated.mode === "auto_cross") {
            const cross = await getCrossRate(
                validated.fromCurrency,
                validated.toCurrency,
                validated.asOf,
                validated.anchor ?? "USD"
            );
            const midToAmount = mulDivFloor(validated.fromAmountMinor, cross.rateNum, cross.rateDen);
            const marginBps = BigInt(policy.marginBps);
            toAmountMinor = (midToAmount * (BPS_SCALE - marginBps)) / BPS_SCALE;
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

        const expiresAt = new Date(validated.asOf.getTime() + policy.ttlSeconds * 1000);

        return db.transaction(async (tx: any) => {
            const inserted = await tx
                .insert(schema.fxQuotes)
                .values({
                    policyId: policy.id,
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

        const [q] = await db
            .select()
            .from(schema.fxQuotes)
            .where(eq(schema.fxQuotes.id, validated.quoteId))
            .limit(1);

        if (!q) {
            throw new NotFoundError("Quote", validated.quoteId);
        }

        if (q.status !== "active") {
            return q;
        }

        if (q.expiresAt.getTime() < validated.at.getTime()) {
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

        return updated[0] ?? q;
    }

    async function expireOldQuotes(now: Date) {
        await db.execute(sql`
      UPDATE ${schema.fxQuotes}
      SET status = 'expired'
      WHERE status = 'active'
        AND expires_at <= ${now}
    `);
    }

    return {
        upsertPolicy,
        setManualRate,
        getLatestRate,
        getCrossRate,
        quote,
        getQuoteDetails,
        markQuoteUsed,
        expireOldQuotes,
    };
}
