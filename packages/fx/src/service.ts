import { and, desc, eq, sql } from "drizzle-orm";
import { schema } from "@repo/db/schema";
import { type Database } from "@repo/db";
import { type Logger, noopLogger, normalizeCurrency } from "@repo/kernel";
import { QuoteExpiredError, RateNotFoundError } from "./errors";

function mulDivFloor(a: bigint, num: bigint, den: bigint): bigint {
    if (den <= 0n) throw new Error("rateDen must be > 0");
    return (a * num) / den;
}

const BPS_SCALE = 10000n;

export function createFxService(deps: { db: Database; logger?: Logger }) {
    const { db } = deps;
    const log = deps.logger?.child({ svc: "fx" }) ?? noopLogger;

    async function upsertPolicy(input: {
        idempotencyKey: string;
        name: string;
        marginBps: number;
        feeBps: number;
        ttlSeconds: number;
    }) {
        const inserted = await db
            .insert(schema.fxPolicies)
            .values({
                name: input.name,
                marginBps: input.marginBps,
                feeBps: input.feeBps,
                ttlSeconds: input.ttlSeconds
            })
            .returning({ id: schema.fxPolicies.id });

        return inserted[0]!.id;
    }

    async function setManualRate(input: {
        base: string;
        quote: string;
        rateNum: bigint;
        rateDen: bigint;
        asOf: Date;
        source?: string;
    }) {
        const base = normalizeCurrency(input.base);
        const quote = normalizeCurrency(input.quote);
        await db.insert(schema.fxRates).values({
            base,
            quote,
            rateNum: input.rateNum,
            rateDen: input.rateDen,
            asOf: input.asOf,
            source: input.source ?? "manual"
        });
        log.info("setManualRate", { base, quote, rateNum: input.rateNum.toString(), rateDen: input.rateDen.toString() });
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
    async function quote(input: {
        idempotencyKey: string;
        policyId: string;
        fromCurrency: string;
        toCurrency: string;
        fromAmountMinor: bigint;
        asOf: Date;
        anchor?: string;
    }) {
        const from = normalizeCurrency(input.fromCurrency);
        const to = normalizeCurrency(input.toCurrency);
        if (input.fromAmountMinor <= 0n) throw new Error("fromAmountMinor must be > 0");

        // idempotent: if exists, return
        const existing = await db.select().from(schema.fxQuotes).where(eq(schema.fxQuotes.idempotencyKey, input.idempotencyKey)).limit(1);
        if (existing.length) return existing[0]!;

        const [policy] = await db.select().from(schema.fxPolicies).where(eq(schema.fxPolicies.id, input.policyId)).limit(1);
        if (!policy || !policy.isActive) throw new Error("Policy not found/inactive");

        const r = await getCrossRate(from, to, input.asOf, input.anchor ?? "USD");

        // mid toAmount
        const midTo = mulDivFloor(input.fromAmountMinor, r.rateNum, r.rateDen);

        // margin reduces customer output: customer gets less toCurrency
        const marginBps = BigInt(policy.marginBps);
        const feeBps = BigInt(policy.feeBps);

        // customerTo = midTo * (1 - marginBps/10000)
        const customerTo = (midTo * (BPS_SCALE - marginBps)) / BPS_SCALE;

        // spread approximated in FROM currency as fromAmount * marginBps/10000 (MVP)
        const spreadFrom = (input.fromAmountMinor * marginBps) / BPS_SCALE;
        const feeFrom = (input.fromAmountMinor * feeBps) / BPS_SCALE;

        const expiresAt = new Date(input.asOf.getTime() + policy.ttlSeconds * 1000);

        const inserted = await db
            .insert(schema.fxQuotes)
            .values({
                policyId: policy.id,
                fromCurrency: from,
                toCurrency: to,
                fromAmountMinor: input.fromAmountMinor,
                toAmountMinor: customerTo,
                feeFromMinor: feeFrom,
                spreadFromMinor: spreadFrom,
                rateNum: r.rateNum,
                rateDen: r.rateDen,
                expiresAt,
                status: "active",
                idempotencyKey: input.idempotencyKey
            })
            .returning();

        log.info("quote created", {
            quoteId: inserted[0]!.id,
            from,
            to,
            fromAmount: input.fromAmountMinor.toString(),
            toAmount: customerTo.toString()
        });
        return inserted[0]!;
    }

    async function markQuoteUsed(input: { quoteId: string; usedByRef: string; at: Date }) {
        const [q] = await db.select().from(schema.fxQuotes).where(eq(schema.fxQuotes.id, input.quoteId)).limit(1);
        if (!q) throw new Error("Quote not found");

        if (q.status !== "active") return q;
        if (q.expiresAt.getTime() < input.at.getTime()) throw new QuoteExpiredError("Quote expired");

        const updated = await db
            .update(schema.fxQuotes)
            .set({
                status: "used",
                usedByRef: input.usedByRef,
                usedAt: input.at
            })
            .where(and(eq(schema.fxQuotes.id, input.quoteId), eq(schema.fxQuotes.status, "active")))
            .returning();

        if (updated.length) {
            log.info("quote used", { quoteId: input.quoteId, usedByRef: input.usedByRef });
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
        log.debug("expireOldQuotes", { expiredCount: result.rowCount ?? 0 });
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
