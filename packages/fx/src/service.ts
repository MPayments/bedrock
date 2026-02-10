import { and, desc, eq, sql } from "drizzle-orm";
import { schema, type FxQuote } from "@repo/db/schema";
import { type Database } from "@repo/db";
import { type Logger, normalizeCurrency } from "@repo/kernel";
import { QuoteExpiredError, RateNotFoundError, NotFoundError, PolicyNotFoundError } from "./errors";
import {
    validateUpsertPolicyInput,
    validateSetManualRateInput,
    validateQuoteInput,
    validateMarkQuoteUsedInput,
    type UpsertPolicyInput,
    type SetManualRateInput,
    type QuoteInput,
    type MarkQuoteUsedInput,
} from "./validation";

function mulDivFloor(a: bigint, num: bigint, den: bigint): bigint {
    if (den <= 0n) throw new Error("rateDen must be > 0");
    return (a * num) / den;
}

const BPS_SCALE = 10000n;

export type FxService = ReturnType<typeof createFxService>;

export function createFxService(deps: { db: Database; logger?: Logger }) {
    const { db } = deps;
    const log = deps.logger?.child({ svc: "fx" });

    async function upsertPolicy(input: UpsertPolicyInput) {
        const validated = validateUpsertPolicyInput(input);

        log?.debug("Creating FX policy", {
            name: validated.name,
            marginBps: validated.marginBps,
            feeBps: validated.feeBps,
            ttlSeconds: validated.ttlSeconds,
        });

        const inserted = await db
            .insert(schema.fxPolicies)
            .values({
                name: validated.name,
                marginBps: validated.marginBps,
                feeBps: validated.feeBps,
                ttlSeconds: validated.ttlSeconds
            })
            .returning({ id: schema.fxPolicies.id });

        log?.info("FX policy created", {
            policyId: inserted[0]!.id,
            name: validated.name,
        });

        return inserted[0]!.id;
    }

    async function setManualRate(input: SetManualRateInput) {
        const validated = validateSetManualRateInput(input);

        log?.debug("Setting manual FX rate", {
            base: validated.base,
            quote: validated.quote,
            rateNum: validated.rateNum.toString(),
            rateDen: validated.rateDen.toString(),
        });

        await db.insert(schema.fxRates).values({
            base: validated.base,
            quote: validated.quote,
            rateNum: validated.rateNum,
            rateDen: validated.rateDen,
            asOf: validated.asOf,
            source: validated.source ?? "manual"
        });

        log?.info("Manual FX rate set", {
            base: validated.base,
            quote: validated.quote,
            rateNum: validated.rateNum.toString(),
            rateDen: validated.rateDen.toString(),
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

    /**
     * Упрощенный cross-rate:
     * - сначала пробуем прямой base->quote
     * - иначе через USD: base->USD и USD->quote (можно поменять anchor на любую)
     */
    async function getCrossRate(base: string, quote: string, asOf: Date, anchor = "USD") {
        base = normalizeCurrency(base);
        quote = normalizeCurrency(quote);
        anchor = normalizeCurrency(anchor);

        if (base === quote) return {
            base,
            quote,
            rateNum: 1n,
            rateDen: 1n,
        };

        // direct
        try {
            const r = await getLatestRate(base, quote, asOf);
            return {
                base,
                quote,
                rateNum: r.rateNum,
                rateDen: r.rateDen,
            };
        } catch { }

        // inverse direct
        try {
            const r = await getLatestRate(quote, base, asOf);
            return {
                base,
                quote,
                rateNum: r.rateDen,
                rateDen: r.rateNum,
            };
        } catch { }

        if (base === anchor || quote === anchor) {
            throw new RateNotFoundError(`No direct/inverse rate for ${base}/${quote} and anchor path not possible`);
        }

        const a = await getLatestRate(base, anchor, asOf).catch(async () => {
            const inv = await getLatestRate(anchor, base, asOf);
            return {
                rateNum: inv.rateDen,
                rateDen: inv.rateNum,
            };
        });

        const b = await getLatestRate(anchor, quote, asOf).catch(async () => {
            const inv = await getLatestRate(quote, anchor, asOf);
            return {
                rateNum: inv.rateDen,
                rateDen: inv.rateNum,
            };
        });

        // (base->anchor) * (anchor->quote)
        return {
            base,
            quote,
            rateNum: a.rateNum * b.rateNum,
            rateDen: a.rateDen * b.rateDen,
        };
    }

    /**
     * Quote:
     * - fromAmountMinor задан
     * - вычисляем toAmountMinor по mid rate, затем применяем маржу (уменьшаем output)
     * - fee и spread считаем в валюте FROM (упрощенно)
     *
     * Это MVP-уровень: не делаем reservation, позиции, хедж.
     */
    async function quote(input: QuoteInput): Promise<FxQuote> {
        const validated = validateQuoteInput(input);

        log?.debug("Creating FX quote", {
            policyId: validated.policyId,
            fromCurrency: validated.fromCurrency,
            toCurrency: validated.toCurrency,
            fromAmountMinor: validated.fromAmountMinor.toString(),
        });

        // idempotent: if exists, return
        const existing = await db
            .select()
            .from(schema.fxQuotes)
            .where(eq(schema.fxQuotes.idempotencyKey, validated.idempotencyKey))
            .limit(1);

        if (existing.length) {
            log?.debug("Quote already exists (idempotent)", {
                quoteId: existing[0]!.id,
                idempotencyKey: validated.idempotencyKey,
            });
            return existing[0]!;
        }

        const [policy] = await db
            .select()
            .from(schema.fxPolicies)
            .where(eq(schema.fxPolicies.id, validated.policyId))
            .limit(1);

        if (!policy || !policy.isActive) {
            throw new PolicyNotFoundError(validated.policyId);
        }

        const r = await getCrossRate(
            validated.fromCurrency,
            validated.toCurrency,
            validated.asOf,
            validated.anchor ?? "USD"
        );

        // mid toAmount
        const midTo = mulDivFloor(validated.fromAmountMinor, r.rateNum, r.rateDen);

        // margin reduces customer output: customer gets less toCurrency
        const marginBps = BigInt(policy.marginBps);
        const feeBps = BigInt(policy.feeBps);

        // customerTo = midTo * (1 - marginBps/10000)
        const customerTo = (midTo * (BPS_SCALE - marginBps)) / BPS_SCALE;

        // spread approximated in FROM currency as fromAmount * marginBps/10000 (MVP)
        const spreadFrom = (validated.fromAmountMinor * marginBps) / BPS_SCALE;
        const feeFrom = (validated.fromAmountMinor * feeBps) / BPS_SCALE;

        const expiresAt = new Date(validated.asOf.getTime() + policy.ttlSeconds * 1000);

        const inserted = await db
            .insert(schema.fxQuotes)
            .values({
                policyId: policy.id,
                fromCurrency: validated.fromCurrency,
                toCurrency: validated.toCurrency,
                fromAmountMinor: validated.fromAmountMinor,
                toAmountMinor: customerTo,
                feeFromMinor: feeFrom,
                spreadFromMinor: spreadFrom,
                rateNum: r.rateNum,
                rateDen: r.rateDen,
                expiresAt,
                status: "active",
                idempotencyKey: validated.idempotencyKey
            })
            .returning();

        log?.info("FX quote created", {
            quoteId: inserted[0]!.id,
            fromCurrency: validated.fromCurrency,
            toCurrency: validated.toCurrency,
            fromAmountMinor: validated.fromAmountMinor.toString(),
            toAmountMinor: customerTo.toString(),
        });
        return inserted[0]!;
    }

    async function markQuoteUsed(input: MarkQuoteUsedInput): Promise<FxQuote> {
        const validated = validateMarkQuoteUsedInput(input);

        log?.debug("Marking quote as used", {
            quoteId: validated.quoteId,
            usedByRef: validated.usedByRef,
        });

        const [q] = await db
            .select()
            .from(schema.fxQuotes)
            .where(eq(schema.fxQuotes.id, validated.quoteId))
            .limit(1);

        if (!q) {
            throw new NotFoundError("Quote", validated.quoteId);
        }

        if (q.status !== "active") {
            log?.debug("Quote already used or expired", {
                quoteId: validated.quoteId,
                status: q.status,
            });
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
                usedAt: validated.at
            })
            .where(and(
                eq(schema.fxQuotes.id, validated.quoteId),
                eq(schema.fxQuotes.status, "active")
            ))
            .returning();

        if (updated.length) {
            log?.info("Quote marked as used", {
                quoteId: validated.quoteId,
                usedByRef: validated.usedByRef,
            });
        }
        return updated[0] ?? q;
    }

    async function expireOldQuotes(now: Date) {
        const result = await db.execute(sql`
      UPDATE ${schema.fxQuotes}
      SET status = 'expired'
      WHERE status = 'active'
        AND expires_at <= ${now}
    `);
        log?.debug("expireOldQuotes", { expiredCount: result.rowCount ?? 0 });
    }

    return {
        upsertPolicy,
        setManualRate,
        getLatestRate,
        getCrossRate,
        quote,
        markQuoteUsed,
        expireOldQuotes
    };
}
