import { and, asc, desc, eq, ilike, inArray, sql } from "drizzle-orm";

import { type PaginatedList } from "@bedrock/core/pagination";
import {
    aggregateFinancialLines,
    type FinancialLine,
} from "@bedrock/documents/financial-lines";
import { schema, type FxQuote, type FxQuoteLeg } from "@bedrock/fx/schema";
import { effectiveRateFromAmounts, mulDivFloor } from "@bedrock/money/math";
import type { Transaction } from "@bedrock/persistence";

import {
    NotFoundError,
    QuoteExpiredError,
} from "../errors";
import {
    financialLineFromFeeComponent,
    getQuoteFinancialLines,
    saveQuoteFinancialLines,
} from "../internal/financial-lines";
import { type FxServiceContext } from "../internal/context";
import { resolveQuoteByRef } from "../internal/quote-ref";
import { buildAutoCrossTrace, computeExplicitRouteLegs } from "../internal/routes";
import { type FxQuoteDetails } from "../internal/types";
import {
    type GetQuoteDetailsInput,
    type ListFxQuotesQuery,
    type MarkQuoteUsedInput,
    type QuoteInput,
    validateGetQuoteDetailsInput,
    validateListFxQuotesQuery,
    validateMarkQuoteUsedInput,
    validateQuoteInput,
} from "../validation";

const DEFAULT_QUOTE_TTL_SECONDS = 600;

interface CrossRate {
    base: string;
    quote: string;
    rateNum: bigint;
    rateDen: bigint;
}

interface QuoteHandlersDeps {
    getCrossRate: (
        base: string,
        quote: string,
        asOf: Date,
        anchor?: string,
    ) => Promise<CrossRate>;
}

export interface QuoteHandlers {
    quote: (input: QuoteInput) => Promise<FxQuote>;
    listQuotes: (input?: ListFxQuotesQuery) => Promise<PaginatedList<FxQuote>>;
    getQuoteDetails: (input: GetQuoteDetailsInput) => Promise<FxQuoteDetails>;
    markQuoteUsed: (input: MarkQuoteUsedInput) => Promise<FxQuote>;
}

export function createQuoteHandlers(
    context: FxServiceContext,
    deps: QuoteHandlersDeps,
): QuoteHandlers {
    const { db, feesService, currenciesService, log } = context;

    async function resolveCurrencyCodeMap(quotes: FxQuote[]) {
        const uniqueCurrencyIds = [
            ...new Set(
                quotes.flatMap((quote) => [quote.fromCurrencyId, quote.toCurrencyId]),
            ),
        ];
        const codeById = new Map<string, string>();

        await Promise.all(
            uniqueCurrencyIds.map(async (id) => {
                const currency = await currenciesService.findById(id);
                codeById.set(id, currency.code);
            }),
        );

        return codeById;
    }

    async function withQuoteCurrencyCodes(quote: FxQuote) {
        const codeById = await resolveCurrencyCodeMap([quote]);
        return {
            ...quote,
            fromCurrency: codeById.get(quote.fromCurrencyId)!,
            toCurrency: codeById.get(quote.toCurrencyId)!,
        } as FxQuote;
    }

    async function withQuotesCurrencyCodes(quotes: FxQuote[]) {
        if (quotes.length === 0) {
            return [];
        }

        const codeById = await resolveCurrencyCodeMap(quotes);

        return quotes.map((quote) => ({
            ...quote,
            fromCurrency: codeById.get(quote.fromCurrencyId)!,
            toCurrency: codeById.get(quote.toCurrencyId)!,
        })) as FxQuote[];
    }

    async function withLegCurrencyCodes(legs: FxQuoteLeg[]) {
        const uniqueCurrencyIds = [...new Set(legs.flatMap((leg) => [leg.fromCurrencyId, leg.toCurrencyId]))];
        const codeById = new Map<string, string>();
        await Promise.all(
            uniqueCurrencyIds.map(async (id) => {
                const currency = await currenciesService.findById(id);
                codeById.set(id, currency.code);
            }),
        );

        return legs.map((leg) => ({
            ...leg,
            fromCurrency: codeById.get(leg.fromCurrencyId)!,
            toCurrency: codeById.get(leg.toCurrencyId)!,
        })) as FxQuoteLeg[];
    }

    async function getQuoteDetails(input: GetQuoteDetailsInput): Promise<FxQuoteDetails> {
        const vaildated = validateGetQuoteDetailsInput(input);
        const quote = await resolveQuoteByRef(context, vaildated.quoteRef);

        if (!quote) throw new NotFoundError("Quote", vaildated.quoteRef);

        const legs = await db
            .select()
            .from(schema.fxQuoteLegs)
            .where(eq(schema.fxQuoteLegs.quoteId, quote.id))
            .orderBy(schema.fxQuoteLegs.idx);
        const legsWithCurrencyCodes = await withLegCurrencyCodes(legs);

        const feeComponents = await feesService.getQuoteFeeComponents({ quoteId: quote.id });
        const financialLines = await getQuoteFinancialLines({
            context,
            quoteId: quote.id,
        });
        const pricingTrace = (quote.pricingTrace ?? {}) as Record<string, unknown>;

        return {
            quote,
            legs: legsWithCurrencyCodes,
            feeComponents,
            financialLines,
            pricingTrace,
        };
    }

    async function listQuotes(input?: ListFxQuotesQuery): Promise<PaginatedList<FxQuote>> {
        const validated = validateListFxQuotesQuery(input ?? {});
        const conditions = [];

        if (validated.idempotencyKey) {
            conditions.push(
                ilike(schema.fxQuotes.idempotencyKey, `%${validated.idempotencyKey}%`),
            );
        }

        if (validated.status && validated.status.length > 0) {
            conditions.push(
                inArray(schema.fxQuotes.status, validated.status as any),
            );
        }

        if (validated.pricingMode && validated.pricingMode.length > 0) {
            conditions.push(
                inArray(schema.fxQuotes.pricingMode, validated.pricingMode as any),
            );
        }

        const where = conditions.length > 0 ? and(...conditions) : undefined;
        const sortColumn =
            validated.sortBy === "expiresAt"
                ? schema.fxQuotes.expiresAt
                : validated.sortBy === "usedAt"
                    ? schema.fxQuotes.usedAt
                    : validated.sortBy === "status"
                        ? schema.fxQuotes.status
                        : validated.sortBy === "pricingMode"
                            ? schema.fxQuotes.pricingMode
                            : schema.fxQuotes.createdAt;
        const sortDirection =
            validated.sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

        const [rows, totalRows] = await Promise.all([
            db
                .select()
                .from(schema.fxQuotes)
                .where(where)
                .orderBy(sortDirection, desc(schema.fxQuotes.createdAt))
                .limit(validated.limit)
                .offset(validated.offset),
            db
                .select({ total: sql<number>`count(*)::int` })
                .from(schema.fxQuotes)
                .where(where),
        ]);

        return {
            data: await withQuotesCurrencyCodes(rows as FxQuote[]),
            total: totalRows[0]?.total ?? 0,
            limit: validated.limit,
            offset: validated.offset,
        };
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
                executionCounterpartyId: null,
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
        const computedFinancialLines = feeComponents.map(financialLineFromFeeComponent);
        const financialLines = aggregateFinancialLines([
            ...computedFinancialLines,
            ...(validated.manualFinancialLines ?? []),
        ]) as FinancialLine[];

        const ttlSeconds = validated.ttlSeconds ?? DEFAULT_QUOTE_TTL_SECONDS;
        const expiresAt = new Date(validated.asOf.getTime() + ttlSeconds * 1000);

        return db.transaction(async (tx: Transaction) => {
            const currencyCodes = [
                validated.fromCurrency,
                validated.toCurrency,
                ...legs.flatMap((leg) => [leg.fromCurrency, leg.toCurrency]),
            ];
            const uniqueCurrencyCodes = [...new Set(currencyCodes)];
            const currencyIdByCode = new Map<string, string>();
            await Promise.all(
                uniqueCurrencyCodes.map(async (code) => {
                    const currency = await currenciesService.findByCode(code);
                    currencyIdByCode.set(currency.code, currency.id);
                }),
            );

            const inserted = await tx
                .insert(schema.fxQuotes)
                .values({
                    fromCurrencyId: currencyIdByCode.get(validated.fromCurrency)!,
                    toCurrencyId: currencyIdByCode.get(validated.toCurrency)!,
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
                        fromCurrencyId: currencyIdByCode.get(leg.fromCurrency)!,
                        toCurrencyId: currencyIdByCode.get(leg.toCurrency)!,
                        fromAmountMinor: leg.fromAmountMinor,
                        toAmountMinor: leg.toAmountMinor,
                        rateNum: leg.rateNum,
                        rateDen: leg.rateDen,
                        sourceKind: leg.sourceKind,
                        sourceRef: leg.sourceRef,
                        asOf: leg.asOf,
                        executionCounterpartyId: leg.executionCounterpartyId,
                    }))
                );

                await feesService.saveQuoteFeeComponents({
                    quoteId: created.id,
                    components: feeComponents,
                }, tx);
                await saveQuoteFinancialLines({
                    context,
                    quoteId: created.id,
                    financialLines,
                    tx,
                });

                log?.info("FX quote created", {
                    quoteId: created.id,
                    mode: validated.mode,
                    legs: legs.length,
                    feeComponents: feeComponents.length,
                    financialLines: financialLines.length,
                });
                return {
                    ...created,
                    fromCurrency: validated.fromCurrency,
                    toCurrency: validated.toCurrency,
                } as FxQuote;
            }

            const [racedExisting] = await tx
                .select()
                .from(schema.fxQuotes)
                .where(eq(schema.fxQuotes.idempotencyKey, validated.idempotencyKey))
                .limit(1);

            if (!racedExisting) {
                throw new Error(`Quote insert conflict without existing idempotency row: ${validated.idempotencyKey}`);
            }

            return withQuoteCurrencyCodes(racedExisting);
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
            return withQuoteCurrencyCodes(quoteRow);
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

        return withQuoteCurrencyCodes(updated[0] ?? quoteRow);
    }

    return {
        quote,
        listQuotes,
        getQuoteDetails,
        markQuoteUsed,
    };
}
