import { describe, expect, it, vi } from "vitest";

import { schema } from "@bedrock/fx/schema";
import { ValidationError } from "@bedrock/common/errors";

import { NotFoundError, QuoteExpiredError } from "../../src/fx/errors";
import { createFxService } from "../../src/fx/service";
import {
  createMockCurrenciesService,
  createNoopFeesService,
} from "../support/harness/fx";

const QUOTE_ID = "550e8400-e29b-41d4-a716-446655440010";

function selectWhereLimit(rows: any[]) {
    return {
        from: vi.fn(() => ({
            where: vi.fn(() => ({
                limit: vi.fn(async () => rows),
                orderBy: vi.fn(async () => rows),
            })),
        })),
    };
}

function selectWhereOrderBy(rows: any[]) {
    return {
        from: vi.fn(() => ({
            where: vi.fn(() => ({
                orderBy: vi.fn(async () => rows),
            })),
        })),
    };
}

function deleteWhere() {
    return {
        where: vi.fn(async () => undefined),
    };
}

function makeQuote(overrides: Record<string, unknown> = {}) {
    return {
        id: QUOTE_ID,
        fromCurrencyId: "cur-rub",
        toCurrencyId: "cur-aed",
        fromCurrency: "RUB",
        toCurrency: "AED",
        fromAmountMinor: 1_000_000n,
        toAmountMinor: 35_000n,
        pricingMode: "explicit_route",
        pricingTrace: { version: "v1", mode: "explicit_route" },
        dealDirection: "cash_to_usdt",
        dealForm: "conversion",
        rateNum: 7n,
        rateDen: 200n,
        expiresAt: new Date("2026-02-14T00:02:00Z"),
        status: "active",
        usedByRef: null,
        usedAt: null,
        idempotencyKey: "idem-route-1",
        createdAt: new Date("2026-02-14T00:00:00Z"),
        ...overrides,
    };
}

describe("createFxService", () => {
    it("quotes explicit route and persists computed legs + fee snapshot", async () => {
        const createdQuote = makeQuote();
        const insertedLegRows: any[] = [];
        const insertedFinancialLineRows: any[] = [];
        const txInsert = vi.fn((table: unknown) => {
            if (table === schema.fxQuotes) {
                return {
                    values: vi.fn(() => ({
                        onConflictDoNothing: vi.fn(() => ({
                            returning: vi.fn(async () => [createdQuote]),
                        })),
                    })),
                };
            }
            if (table === schema.fxQuoteLegs) {
                return {
                    values: vi.fn(async (rows: any[]) => {
                        insertedLegRows.push(...rows);
                        return rows;
                    }),
                };
            }
            if (table === schema.fxQuoteFinancialLines) {
                return {
                    values: vi.fn(async (rows: any[]) => {
                        insertedFinancialLineRows.push(...rows);
                        return rows;
                    }),
                };
            }
            throw new Error("unexpected insert table");
        });
        const txDelete = vi.fn((table: unknown) => {
            if (table === schema.fxQuoteFinancialLines) {
                return deleteWhere();
            }

            throw new Error("unexpected delete table");
        });
        const db = {
            select: vi.fn(),
            transaction: vi.fn(async (fn: any) => fn({ insert: txInsert, delete: txDelete })),
        } as any;
        const feesService = {
            calculateFxQuoteFeeComponents: vi.fn(async () => [{
                id: "rule:fee-1",
                kind: "fx_fee",
                currency: "RUB",
                amountMinor: 1_000n,
                source: "rule",
                settlementMode: "in_ledger",
            }]),
            saveQuoteFeeComponents: vi.fn(async () => undefined),
            getQuoteFeeComponents: vi.fn(async () => []),
        } as any;
        const service = createFxService({ db, feesService, currenciesService: createMockCurrenciesService() });

        const quote = await service.quote({
            mode: "explicit_route",
            idempotencyKey: "idem-route-1",
            fromCurrency: "RUB",
            toCurrency: "AED",
            fromAmountMinor: 1_000_000n,
            dealDirection: "cash_to_usdt",
            dealForm: "conversion",
            asOf: new Date("2026-02-14T00:00:00Z"),
            pricingTrace: {
                version: "v1",
                mode: "explicit_route",
                steps: [{ leg: 1 }, { leg: 2 }],
            },
            legs: [
                {
                    fromCurrency: "RUB",
                    toCurrency: "USDT",
                    rateNum: 1n,
                    rateDen: 100n,
                    sourceKind: "bank",
                    sourceRef: "bank-book",
                },
                {
                    fromCurrency: "USDT",
                    toCurrency: "AED",
                    rateNum: 35n,
                    rateDen: 10n,
                    sourceKind: "market",
                    sourceRef: "desk",
                },
            ],
        });

        expect(quote).toEqual(createdQuote);
        expect(insertedLegRows).toHaveLength(2);
        expect(insertedLegRows[0]).toMatchObject({
            quoteId: QUOTE_ID,
            idx: 1,
            fromCurrencyId: "cur-rub",
            toCurrencyId: "cur-usdt",
            fromAmountMinor: 1_000_000n,
            toAmountMinor: 10_000n,
        });
        expect(insertedLegRows[1]).toMatchObject({
            idx: 2,
            fromCurrencyId: "cur-usdt",
            toCurrencyId: "cur-aed",
            fromAmountMinor: 10_000n,
            toAmountMinor: 35_000n,
        });
        expect(feesService.saveQuoteFeeComponents).toHaveBeenCalledWith(
            expect.objectContaining({ quoteId: QUOTE_ID }),
            expect.objectContaining({ insert: expect.any(Function) })
        );
        expect(txDelete).toHaveBeenCalledWith(schema.fxQuoteFinancialLines);
        expect(insertedFinancialLineRows).toEqual([
            expect.objectContaining({
                quoteId: QUOTE_ID,
                idx: 1,
                bucket: "fee_revenue",
                currencyId: "cur-rub",
                amountMinor: 1_000n,
                source: "rule",
                settlementMode: "in_ledger",
                metadata: { feeKind: "fx_fee" },
            }),
        ]);
    });

    it("rejects explicit route with broken leg continuity", async () => {
        const db = {
            select: vi.fn(),
            transaction: vi.fn(),
        } as any;
        const feesService = {
            calculateFxQuoteFeeComponents: vi.fn(async () => []),
            saveQuoteFeeComponents: vi.fn(async () => undefined),
            getQuoteFeeComponents: vi.fn(async () => []),
        } as any;
        const service = createFxService({ db, feesService, currenciesService: createMockCurrenciesService() });

        await expect(service.quote({
            mode: "explicit_route",
            idempotencyKey: "idem-route-bad",
            fromCurrency: "RUB",
            toCurrency: "AED",
            fromAmountMinor: 1_000_000n,
            asOf: new Date("2026-02-14T00:00:00Z"),
            pricingTrace: { version: "v1", mode: "explicit_route" },
            legs: [
                {
                    fromCurrency: "RUB",
                    toCurrency: "USDT",
                    rateNum: 1n,
                    rateDen: 100n,
                    sourceKind: "bank",
                },
                {
                    fromCurrency: "BTC",
                    toCurrency: "AED",
                    rateNum: 35n,
                    rateDen: 10n,
                    sourceKind: "market",
                },
            ],
        })).rejects.toThrow(ValidationError);
    });

    it("quotes auto-cross and persists synthetic leg with generated trace", async () => {
        const createdQuote = makeQuote({
            idempotencyKey: "idem-auto-1",
            fromCurrencyId: "cur-usd",
            toCurrencyId: "cur-eur",
            fromCurrency: "USD",
            toCurrency: "EUR",
            fromAmountMinor: 10_000n,
            toAmountMinor: 20_000n,
            pricingMode: "auto_cross",
            pricingTrace: {
                version: "v1",
                mode: "auto_cross",
                anchor: "USD",
            },
            dealDirection: null,
            dealForm: null,
            rateNum: 2n,
            rateDen: 1n,
        });
        const insertedLegRows: any[] = [];
        const txDelete = vi.fn((table: unknown) => {
            if (table === schema.fxQuoteFinancialLines) {
                return deleteWhere();
            }

            throw new Error("unexpected delete table");
        });
        const db = {
            select: vi
                .fn()
                .mockImplementationOnce(() => selectWhereLimit([{
                    base: "USD",
                    quote: "EUR",
                    rateNum: 2n,
                    rateDen: 1n,
                    asOf: new Date("2026-02-14T00:00:00Z"),
                    source: "manual",
                }])),
            transaction: vi.fn(async (fn: any) => fn({
                insert: vi.fn((table: unknown) => {
                    if (table === schema.fxQuotes) {
                        return {
                            values: vi.fn(() => ({
                                onConflictDoNothing: vi.fn(() => ({
                                    returning: vi.fn(async () => [createdQuote]),
                                })),
                            })),
                        };
                    }
                    if (table === schema.fxQuoteLegs) {
                        return {
                            values: vi.fn(async (rows: any[]) => {
                                insertedLegRows.push(...rows);
                                return rows;
                            }),
                        };
                    }
                    throw new Error("unexpected insert table");
                }),
                delete: txDelete,
            })),
        } as any;
        const feesService = {
            calculateFxQuoteFeeComponents: vi.fn(async () => []),
            saveQuoteFeeComponents: vi.fn(async () => undefined),
            getQuoteFeeComponents: vi.fn(async () => []),
        } as any;
        const service = createFxService({ db, feesService, currenciesService: createMockCurrenciesService() });

        const quote = await service.quote({
            mode: "auto_cross",
            idempotencyKey: "idem-auto-1",
            fromCurrency: "USD",
            toCurrency: "EUR",
            fromAmountMinor: 10_000n,
            asOf: new Date("2026-02-14T00:00:00Z"),
        });

        expect(quote).toEqual(createdQuote);
        expect(insertedLegRows).toHaveLength(1);
        expect(insertedLegRows[0]).toMatchObject({
            idx: 1,
            fromCurrencyId: "cur-usd",
            toCurrencyId: "cur-eur",
            fromAmountMinor: 10_000n,
            toAmountMinor: 20_000n,
            sourceKind: "derived",
        });
        expect(txDelete).toHaveBeenCalledWith(schema.fxQuoteFinancialLines);
    });

    it("returns existing quote on idempotency race without duplicating side effects", async () => {
        const existingQuote = makeQuote({ idempotencyKey: "idem-race-1" });
        const insertLegs = vi.fn();
        const txSelect = vi.fn().mockImplementationOnce(() => selectWhereLimit([existingQuote]));
        const db = {
            select: vi.fn(),
            transaction: vi.fn(async (fn: any) => fn({
                insert: vi.fn((table: unknown) => {
                    if (table === schema.fxQuotes) {
                        return {
                            values: vi.fn(() => ({
                                onConflictDoNothing: vi.fn(() => ({
                                    returning: vi.fn(async () => []),
                                })),
                            })),
                        };
                    }
                    if (table === schema.fxQuoteLegs) {
                        return { values: insertLegs };
                    }
                    throw new Error("unexpected insert table");
                }),
                select: txSelect,
            })),
        } as any;
        const feesService = {
            calculateFxQuoteFeeComponents: vi.fn(async () => []),
            saveQuoteFeeComponents: vi.fn(async () => undefined),
            getQuoteFeeComponents: vi.fn(async () => []),
        } as any;
        const service = createFxService({ db, feesService, currenciesService: createMockCurrenciesService() });

        const quote = await service.quote({
            mode: "explicit_route",
            idempotencyKey: "idem-race-1",
            fromCurrency: "RUB",
            toCurrency: "AED",
            fromAmountMinor: 1_000_000n,
            asOf: new Date("2026-02-14T00:00:00Z"),
            pricingTrace: { version: "v1", mode: "explicit_route" },
            legs: [
                {
                    fromCurrency: "RUB",
                    toCurrency: "AED",
                    rateNum: 7n,
                    rateDen: 200n,
                    sourceKind: "manual",
                },
            ],
        });

        expect(quote).toEqual(existingQuote);
        expect(insertLegs).not.toHaveBeenCalled();
        expect(feesService.saveQuoteFeeComponents).not.toHaveBeenCalled();
    });

    it("returns quote details with legs, persisted fee snapshot, and pricing trace", async () => {
        const quote = makeQuote({ idempotencyKey: "idem-details-1" });
        const legs = [
            {
                id: "11111111-1111-4111-8111-111111111111",
                quoteId: quote.id,
                idx: 1,
                fromCurrencyId: "cur-rub",
                toCurrencyId: "cur-usdt",
                fromCurrency: "RUB",
                toCurrency: "USDT",
                fromAmountMinor: 1_000_000n,
                toAmountMinor: 10_000n,
                rateNum: 1n,
                rateDen: 100n,
                sourceKind: "bank",
                sourceRef: "bank-book",
                asOf: new Date("2026-02-14T00:00:00Z"),
                executionCounterpartyId: null,
                createdAt: new Date("2026-02-14T00:00:00Z"),
            },
        ];
        const financialLines = [{
            quoteId: quote.id,
            idx: 1,
            bucket: "fee_revenue",
            currencyId: "cur-rub",
            amountMinor: 300n,
            source: "rule",
            settlementMode: "in_ledger",
            memo: "bank fee",
            metadata: { feeKind: "bank_fee" },
        }];
        const feeComponents = [{
            id: "quote_component:1",
            kind: "bank_fee",
            currency: "RUB",
            amountMinor: 300n,
            source: "rule",
            settlementMode: "in_ledger",
        }];
        const db = {
            select: vi
                .fn()
                .mockImplementationOnce(() => selectWhereLimit([quote]))
                .mockImplementationOnce(() => selectWhereOrderBy(legs))
                .mockImplementationOnce(() => selectWhereLimit(financialLines)),
        } as any;
        const feesService = {
            calculateFxQuoteFeeComponents: vi.fn(async () => []),
            saveQuoteFeeComponents: vi.fn(async () => undefined),
            getQuoteFeeComponents: vi.fn(async () => feeComponents),
        } as any;
        const service = createFxService({ db, feesService, currenciesService: createMockCurrenciesService() });

        const details = await service.getQuoteDetails({ quoteRef: "idem-details-1" });

        expect(details.quote).toEqual(quote);
        expect(details.legs).toEqual(legs);
        expect(details.feeComponents).toEqual(feeComponents);
        expect(details.financialLines).toEqual([
            {
                id: "quote_financial_line:550e8400-e29b-41d4-a716-446655440010:1",
                bucket: "fee_revenue",
                currency: "RUB",
                amountMinor: 300n,
                source: "rule",
                settlementMode: "in_ledger",
                memo: "bank fee",
                metadata: { feeKind: "bank_fee" },
            },
        ]);
        expect(details.pricingTrace).toEqual({ version: "v1", mode: "explicit_route" });
    });

    it("rejects ambiguous UUID quoteRef between id and idempotency key in getQuoteDetails", async () => {
        const uuidQuoteRef = "550e8400-e29b-41d4-a716-446655440099";
        const byId = makeQuote({ id: uuidQuoteRef, idempotencyKey: "idem-1" });
        const byIdempotency = makeQuote({ id: QUOTE_ID, idempotencyKey: uuidQuoteRef });
        const db = {
            select: vi
                .fn()
                .mockImplementationOnce(() => selectWhereLimit([byId]))
                .mockImplementationOnce(() => selectWhereLimit([byIdempotency])),
        } as any;
        const feesService = {
            calculateFxQuoteFeeComponents: vi.fn(async () => []),
            saveQuoteFeeComponents: vi.fn(async () => undefined),
            getQuoteFeeComponents: vi.fn(async () => []),
        } as any;
        const service = createFxService({ db, feesService, currenciesService: createMockCurrenciesService() });

        await expect(service.getQuoteDetails({ quoteRef: uuidQuoteRef })).rejects.toThrow(ValidationError);
    });

    it("throws NotFoundError when markQuoteUsed cannot find quote", async () => {
        const db = {
            select: vi.fn(() => selectWhereLimit([])),
            update: vi.fn(),
        } as any;
        const service = createFxService({
            db,
            feesService: createNoopFeesService(),
            currenciesService: createMockCurrenciesService(),
        });

        await expect(
            service.markQuoteUsed({
                quoteId: QUOTE_ID,
                usedByRef: "order:1:fx",
                at: new Date("2026-02-14T00:00:00Z"),
            }),
        ).rejects.toThrow(NotFoundError);
    });

    it("returns quote as-is when markQuoteUsed is called for non-active quote", async () => {
        const quote = makeQuote({
            status: "used",
            usedByRef: "order:1:fx",
            usedAt: new Date("2026-02-14T00:00:00Z"),
        });

        const db = {
            select: vi.fn(() => selectWhereLimit([quote])),
            update: vi.fn(),
        } as any;
        const service = createFxService({
            db,
            feesService: createNoopFeesService(),
            currenciesService: createMockCurrenciesService(),
        });

        const result = await service.markQuoteUsed({
            quoteId: QUOTE_ID,
            usedByRef: "order:2:fx",
            at: new Date("2026-02-14T00:01:00Z"),
        });

        expect(result).toEqual(quote);
        expect(db.update).not.toHaveBeenCalled();
    });

    it("throws QuoteExpiredError when markQuoteUsed is called after expiry", async () => {
        const quote = makeQuote({
            status: "active",
            expiresAt: new Date("2026-02-14T00:00:00Z"),
        });

        const db = {
            select: vi.fn(() => selectWhereLimit([quote])),
            update: vi.fn(),
        } as any;
        const service = createFxService({
            db,
            feesService: createNoopFeesService(),
            currenciesService: createMockCurrenciesService(),
        });

        await expect(
            service.markQuoteUsed({
                quoteId: QUOTE_ID,
                usedByRef: "order:3:fx",
                at: new Date("2026-02-14T00:01:00Z"),
            }),
        ).rejects.toThrow(QuoteExpiredError);
    });

    it("marks active quote as used and returns updated row", async () => {
        const quote = makeQuote({
            status: "active",
            expiresAt: new Date("2026-02-14T00:05:00Z"),
        });
        const updated = {
            ...quote,
            status: "used",
            usedByRef: "order:4:fx",
            usedAt: new Date("2026-02-14T00:01:00Z"),
        };

        const db = {
            select: vi.fn(() => selectWhereLimit([quote])),
            update: vi.fn(() => ({
                set: vi.fn(() => ({
                    where: vi.fn(() => ({
                        returning: vi.fn(async () => [updated]),
                    })),
                })),
            })),
        } as any;
        const service = createFxService({
            db,
            feesService: createNoopFeesService(),
            currenciesService: createMockCurrenciesService(),
        });

        const result = await service.markQuoteUsed({
            quoteId: QUOTE_ID,
            usedByRef: "order:4:fx",
            at: new Date("2026-02-14T00:01:00Z"),
        });

        expect(result.status).toBe("used");
        expect(result.usedByRef).toBe("order:4:fx");
    });
});
