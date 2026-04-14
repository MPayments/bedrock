import { describe, expect, it, vi } from "vitest";

import { createPersistenceContext } from "@bedrock/platform/persistence";
import { InvariantViolationError } from "@bedrock/shared/core/domain";
import { ValidationError } from "@bedrock/shared/core/errors";
import { schema } from "@bedrock/treasury/schema";

import { createTreasuryTestService } from "./create-treasury-test-service";
import {
  createMockCurrenciesService,
  createNoopFeesService,
} from "./helpers";
import { NotFoundError, QuoteExpiredError } from "../src/errors";

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

function selectWhereOrderByLimitOffset(rows: any[]) {
    return {
        from: vi.fn(() => ({
            where: vi.fn(() => ({
                orderBy: vi.fn(() => ({
                    limit: vi.fn(() => ({
                        offset: vi.fn(async () => rows),
                    })),
                })),
            })),
        })),
    };
}

function selectWhere(rows: any[]) {
    return {
        from: vi.fn(() => ({
            where: vi.fn(async () => rows),
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
        commercialTerms: {
            agreementVersionId: null,
            agreementFeeBps: 0n,
            quoteMarkupBps: 0n,
            totalFeeBps: 0n,
            fixedFeeAmountMinor: null,
            fixedFeeCurrency: null,
        },
        dealDirection: "cash_to_usdt",
        dealForm: "conversion",
        rateNum: 7n,
        rateDen: 200n,
        expiresAt: new Date("2026-02-15T00:00:00Z"),
        status: "active",
        dealId: null,
        usedByRef: null,
        usedDocumentId: null,
        usedAt: null,
        idempotencyKey: "idem-route-1",
        createdAt: new Date("2026-02-14T00:00:00Z"),
        ...overrides,
    };
}

describe("createTreasuryTestService", () => {
    it("quotes explicit route and persists computed legs + fee snapshot", async () => {
        const createdQuote = makeQuote({
            commercialTerms: {
                agreementVersionId: "550e8400-e29b-41d4-a716-446655440099",
                agreementFeeBps: 100n,
                quoteMarkupBps: 50n,
                totalFeeBps: 150n,
                fixedFeeAmountMinor: 250n,
                fixedFeeCurrency: "AED",
            },
        });
        const insertedLegRows: any[] = [];
        const insertedFeeComponentRows: any[] = [];
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
            if (table === schema.fxQuoteFeeComponents) {
                return {
                    values: vi.fn(async (rows: any[]) => {
                        insertedFeeComponentRows.push(...rows);
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
            if (table === schema.fxQuoteFeeComponents) {
                return deleteWhere();
            }
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
            calculateQuoteFeeComponents: vi.fn(async () => [{
                id: "rule:fee-1",
                kind: "fx_fee",
                currency: "RUB",
                amountMinor: 1_000n,
                source: "rule",
                settlementMode: "in_ledger",
            }]),
        } as any;
        const service = createTreasuryTestService({ persistence: createPersistenceContext(db), feesService, currenciesService: createMockCurrenciesService() });

        const quote = await service.quotes.quote({
            mode: "explicit_route",
            idempotencyKey: "idem-route-1",
            fromCurrency: "RUB",
            toCurrency: "AED",
            fromAmountMinor: 1_000_000n,
            commercialTerms: {
                agreementVersionId: "550e8400-e29b-41d4-a716-446655440099",
                agreementFeeBps: "100",
                quoteMarkupBps: "50",
                fixedFeeAmount: "2.50",
                fixedFeeCurrency: "AED",
            },
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
        expect(txDelete).toHaveBeenCalledWith(schema.fxQuoteFeeComponents);
        expect(txDelete).toHaveBeenCalledWith(schema.fxQuoteFinancialLines);
        expect(insertedFeeComponentRows).toEqual([
            expect.objectContaining({
                quoteId: QUOTE_ID,
                idx: 1,
                ruleId: null,
                kind: "fx_fee",
                currencyId: "cur-rub",
                amountMinor: 1_000n,
                source: "rule",
                settlementMode: "in_ledger",
            }),
            expect.objectContaining({
                quoteId: QUOTE_ID,
                idx: 2,
                kind: "agreement_fee",
                currencyId: "cur-rub",
                amountMinor: 10_000n,
                source: "manual",
                settlementMode: "in_ledger",
            }),
            expect.objectContaining({
                quoteId: QUOTE_ID,
                idx: 3,
                kind: "quote_markup",
                currencyId: "cur-rub",
                amountMinor: 5_000n,
                source: "manual",
                settlementMode: "in_ledger",
            }),
            expect.objectContaining({
                quoteId: QUOTE_ID,
                idx: 4,
                kind: "agreement_fixed_fee",
                currencyId: "cur-aed",
                amountMinor: 250n,
                source: "manual",
                settlementMode: "in_ledger",
            }),
        ]);
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
            expect.objectContaining({
                quoteId: QUOTE_ID,
                idx: 2,
                bucket: "fee_revenue",
                currencyId: "cur-rub",
                amountMinor: 10_000n,
                source: "manual",
                settlementMode: "in_ledger",
            }),
            expect.objectContaining({
                quoteId: QUOTE_ID,
                idx: 3,
                bucket: "fee_revenue",
                currencyId: "cur-rub",
                amountMinor: 5_000n,
                source: "manual",
                settlementMode: "in_ledger",
            }),
            expect.objectContaining({
                quoteId: QUOTE_ID,
                idx: 4,
                bucket: "pass_through",
                currencyId: "cur-aed",
                amountMinor: 250n,
                source: "manual",
                settlementMode: "in_ledger",
            }),
        ]);
    });

    it("rejects explicit route with broken leg continuity", async () => {
        const db = {
            select: vi.fn(),
            transaction: vi.fn(),
        } as any;
        const feesService = {
            calculateQuoteFeeComponents: vi.fn(async () => []),
        } as any;
        const service = createTreasuryTestService({ persistence: createPersistenceContext(db), feesService, currenciesService: createMockCurrenciesService() });

        await expect(service.quotes.quote({
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
        })).rejects.toThrow(InvariantViolationError);
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
            if (table === schema.fxQuoteFeeComponents) {
                return deleteWhere();
            }
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
            calculateQuoteFeeComponents: vi.fn(async () => []),
        } as any;
        const service = createTreasuryTestService({ persistence: createPersistenceContext(db), feesService, currenciesService: createMockCurrenciesService() });

        const quote = await service.quotes.quote({
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

    it("quotes auto-cross from target amount for payment-style requests", async () => {
        const createdQuote = makeQuote({
            idempotencyKey: "idem-auto-target-1",
            fromCurrencyId: "cur-rub",
            toCurrencyId: "cur-usd",
            fromCurrency: "RUB",
            toCurrency: "USD",
            fromAmountMinor: 5_000n,
            toAmountMinor: 1_000n,
            pricingMode: "auto_cross",
            pricingTrace: {
                version: "v1",
                mode: "auto_cross",
                anchor: "USD",
            },
            dealDirection: null,
            dealForm: null,
            rateNum: 1n,
            rateDen: 5n,
        });
        const insertedLegRows: any[] = [];
        const txDelete = vi.fn((table: unknown) => {
            if (table === schema.fxQuoteFeeComponents) {
                return deleteWhere();
            }
            if (table === schema.fxQuoteFinancialLines) {
                return deleteWhere();
            }

            throw new Error("unexpected delete table");
        });
        const db = {
            select: vi
                .fn()
                .mockImplementationOnce(() => selectWhereLimit([{
                    base: "RUB",
                    quote: "USD",
                    rateNum: 1n,
                    rateDen: 5n,
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
            calculateQuoteFeeComponents: vi.fn(async () => []),
        } as any;
        const service = createTreasuryTestService({
            persistence: createPersistenceContext(db),
            feesService,
            currenciesService: createMockCurrenciesService(),
        });

        const quote = await service.quotes.quote({
            mode: "auto_cross",
            idempotencyKey: "idem-auto-target-1",
            fromCurrency: "RUB",
            toCurrency: "USD",
            toAmountMinor: 1_000n,
            asOf: new Date("2026-02-14T00:00:00Z"),
        });

        expect(quote).toEqual(createdQuote);
        expect(insertedLegRows).toHaveLength(1);
        expect(insertedLegRows[0]).toMatchObject({
            idx: 1,
            fromCurrencyId: "cur-rub",
            toCurrencyId: "cur-usd",
            fromAmountMinor: 5_000n,
            toAmountMinor: 1_000n,
            sourceKind: "derived",
        });
        expect(feesService.calculateQuoteFeeComponents).toHaveBeenCalledWith(
            expect.objectContaining({
                principalMinor: 5_000n,
            }),
        );
    });

    it("returns existing quote on idempotency race without duplicating side effects", async () => {
        const existingQuote = makeQuote({
            idempotencyKey: "idem-race-1",
            dealDirection: null,
            dealForm: null,
            expiresAt: new Date("2026-02-15T00:00:00Z"),
        });
        const insertLegs = vi.fn();
        const txSelect = vi
            .fn()
            .mockImplementationOnce(() => selectWhereLimit([existingQuote]))
            .mockImplementationOnce(() => selectWhereOrderBy([{
                id: "550e8400-e29b-41d4-a716-446655440099",
                quoteId: existingQuote.id,
                idx: 1,
                fromCurrencyId: "cur-rub",
                toCurrencyId: "cur-aed",
                fromAmountMinor: 1_000_000n,
                toAmountMinor: 35_000n,
                rateNum: 7n,
                rateDen: 200n,
                sourceKind: "manual",
                sourceRef: null,
                asOf: new Date("2026-02-14T00:00:00Z"),
                executionCounterpartyId: null,
                createdAt: new Date("2026-02-14T00:00:00Z"),
            }]))
            .mockImplementationOnce(() => selectWhereLimit([]))
            .mockImplementationOnce(() => selectWhereOrderBy([]));
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
            calculateQuoteFeeComponents: vi.fn(async () => []),
        } as any;
        const service = createTreasuryTestService({ persistence: createPersistenceContext(db), feesService, currenciesService: createMockCurrenciesService() });

        const quote = await service.quotes.quote({
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
    });

    it("rejects conflicting idempotency replay", async () => {
        const existingQuote = makeQuote({
            idempotencyKey: "idem-race-conflict-1",
            dealDirection: null,
            dealForm: null,
            expiresAt: new Date("2026-02-15T00:00:00Z"),
        });
        const txSelect = vi
            .fn()
            .mockImplementationOnce(() => selectWhereLimit([existingQuote]))
            .mockImplementationOnce(() => selectWhereOrderBy([{
                id: "550e8400-e29b-41d4-a716-446655440099",
                quoteId: existingQuote.id,
                idx: 1,
                fromCurrencyId: "cur-rub",
                toCurrencyId: "cur-aed",
                fromAmountMinor: 1_000_000n,
                toAmountMinor: 35_000n,
                rateNum: 7n,
                rateDen: 200n,
                sourceKind: "manual",
                sourceRef: null,
                asOf: new Date("2026-02-14T00:00:00Z"),
                executionCounterpartyId: null,
                createdAt: new Date("2026-02-14T00:00:00Z"),
            }]))
            .mockImplementationOnce(() => selectWhereLimit([]))
            .mockImplementationOnce(() => selectWhereOrderBy([]));
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
                    throw new Error("unexpected insert table");
                }),
                select: txSelect,
            })),
        } as any;
        const feesService = {
            calculateQuoteFeeComponents: vi.fn(async () => []),
        } as any;
        const service = createTreasuryTestService({ persistence: createPersistenceContext(db), feesService, currenciesService: createMockCurrenciesService() });

        await expect(service.quotes.quote({
            mode: "explicit_route",
            idempotencyKey: "idem-race-conflict-1",
            fromCurrency: "RUB",
            toCurrency: "AED",
            fromAmountMinor: 1_000_000n,
            asOf: new Date("2026-02-14T00:00:00Z"),
            pricingTrace: { version: "v1", mode: "explicit_route" },
            legs: [
                {
                    fromCurrency: "RUB",
                    toCurrency: "AED",
                    rateNum: 8n,
                    rateDen: 200n,
                    sourceKind: "manual",
                },
            ],
        })).rejects.toThrow("idempotency");
    });

    it("lists quotes with paginated rows and currency codes", async () => {
        const firstQuote = makeQuote({
            id: "550e8400-e29b-41d4-a716-446655440011",
            idempotencyKey: "idem-list-1",
            status: "active",
            pricingMode: "explicit_route",
        });
        const secondQuote = makeQuote({
            id: "550e8400-e29b-41d4-a716-446655440012",
            idempotencyKey: "idem-list-2",
            fromCurrencyId: "cur-usd",
            toCurrencyId: "cur-eur",
            status: "used",
            pricingMode: "auto_cross",
            usedByRef: "invoice:1",
            usedAt: new Date("2026-02-14T00:03:00Z"),
        });

        const db = {
            select: vi
                .fn()
                .mockImplementationOnce(() =>
                    selectWhereOrderByLimitOffset([firstQuote, secondQuote]),
                )
                .mockImplementationOnce(() => selectWhere([{ total: 2 }])),
        } as any;
        const service = createTreasuryTestService({
            persistence: createPersistenceContext(db),
            feesService: createNoopFeesService(),
            currenciesService: createMockCurrenciesService(),
        });

        const result = await service.quotes.listQuotes({
            limit: 20,
            offset: 0,
            status: ["active", "used"],
            pricingMode: ["explicit_route", "auto_cross"],
        });

        expect(result).toEqual({
            data: [
                firstQuote,
                {
                    ...secondQuote,
                    fromCurrency: "USD",
                    toCurrency: "EUR",
                },
            ],
            total: 2,
            limit: 20,
            offset: 0,
        });
    });

    it("previews auto-cross quotes without persisting rows", async () => {
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
            transaction: vi.fn(async () => {
                throw new Error("previewQuote must not open a transaction");
            }),
        } as any;
        const feesService = {
            calculateQuoteFeeComponents: vi.fn(async () => [{
                id: "rule:fee-1",
                kind: "fx_fee",
                currency: "USD",
                amountMinor: 125n,
                source: "rule",
                settlementMode: "in_ledger",
            }]),
        } as any;
        const service = createTreasuryTestService({
            persistence: createPersistenceContext(db),
            feesService,
            currenciesService: createMockCurrenciesService(),
        });

        const preview = await service.quotes.previewQuote({
            mode: "auto_cross",
            fromCurrency: "USD",
            toCurrency: "EUR",
            fromAmountMinor: 10_000n,
            asOf: new Date("2026-02-14T00:00:00Z"),
        });

        expect(preview).toMatchObject({
            fromCurrency: "USD",
            toCurrency: "EUR",
            fromAmountMinor: 10_000n,
            toAmountMinor: 20_000n,
            pricingMode: "auto_cross",
            rateNum: 2n,
            rateDen: 1n,
        });
        expect(preview.legs).toEqual([
            expect.objectContaining({
                idx: 1,
                fromCurrency: "USD",
                toCurrency: "EUR",
                fromAmountMinor: 10_000n,
                toAmountMinor: 20_000n,
            }),
        ]);
        expect(preview.financialLines).toEqual([
            expect.objectContaining({
                bucket: "fee_revenue",
                currency: "USD",
                amountMinor: 125n,
                source: "rule",
            }),
        ]);
        expect(db.transaction).not.toHaveBeenCalled();
    });

    it("previews auto-cross quotes from target amount", async () => {
        const db = {
            select: vi
                .fn()
                .mockImplementationOnce(() => selectWhereLimit([{
                    base: "RUB",
                    quote: "USD",
                    rateNum: 1n,
                    rateDen: 5n,
                    asOf: new Date("2026-02-14T00:00:00Z"),
                    source: "manual",
                }])),
            transaction: vi.fn(async () => {
                throw new Error("previewQuote must not open a transaction");
            }),
        } as any;
        const feesService = {
            calculateQuoteFeeComponents: vi.fn(async () => []),
        } as any;
        const service = createTreasuryTestService({
            persistence: createPersistenceContext(db),
            feesService,
            currenciesService: createMockCurrenciesService(),
        });

        const preview = await service.quotes.previewQuote({
            mode: "auto_cross",
            fromCurrency: "RUB",
            toCurrency: "USD",
            toAmountMinor: 1_000n,
            asOf: new Date("2026-02-14T00:00:00Z"),
        });

        expect(preview).toMatchObject({
            fromCurrency: "RUB",
            toCurrency: "USD",
            fromAmountMinor: 5_000n,
            toAmountMinor: 1_000n,
            pricingMode: "auto_cross",
            rateNum: 1n,
            rateDen: 5n,
        });
        expect(preview.legs).toEqual([
            expect.objectContaining({
                idx: 1,
                fromCurrency: "RUB",
                toCurrency: "USD",
                fromAmountMinor: 5_000n,
                toAmountMinor: 1_000n,
            }),
        ]);
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
            id: "quote_component:550e8400-e29b-41d4-a716-446655440010:1",
            kind: "bank_fee",
            currency: "RUB",
            amountMinor: 300n,
            source: "rule",
            settlementMode: "in_ledger",
            ruleId: undefined,
            memo: undefined,
            metadata: undefined,
        }];
        const feeComponentRows = [{
            quoteId: quote.id,
            idx: 1,
            ruleId: null,
            kind: "bank_fee",
            currencyId: "cur-rub",
            amountMinor: 300n,
            source: "rule",
            settlementMode: "in_ledger",
            memo: null,
            metadata: null,
        }];
        const db = {
            select: vi
                .fn()
                .mockImplementationOnce(() => selectWhereLimit([quote]))
                .mockImplementationOnce(() => selectWhereOrderBy(legs))
                .mockImplementationOnce(() => selectWhereLimit(feeComponentRows))
                .mockImplementationOnce(() => selectWhereLimit(financialLines)),
        } as any;
        const feesService = {
            calculateQuoteFeeComponents: vi.fn(async () => []),
        } as any;
        const service = createTreasuryTestService({ persistence: createPersistenceContext(db), feesService, currenciesService: createMockCurrenciesService() });

        const details = await service.quotes.getQuoteDetails({ quoteRef: "idem-details-1" });

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
            calculateQuoteFeeComponents: vi.fn(async () => []),
        } as any;
        const service = createTreasuryTestService({ persistence: createPersistenceContext(db), feesService, currenciesService: createMockCurrenciesService() });

        await expect(service.quotes.getQuoteDetails({ quoteRef: uuidQuoteRef })).rejects.toThrow(ValidationError);
    });

    it("throws NotFoundError when markQuoteUsed cannot find quote", async () => {
        const db = {
            select: vi.fn(() => selectWhereLimit([])),
            update: vi.fn(),
        } as any;
        const service = createTreasuryTestService({
            persistence: createPersistenceContext(db),
            feesService: createNoopFeesService(),
            currenciesService: createMockCurrenciesService(),
        });

        await expect(
            service.quotes.markQuoteUsed({
                quoteId: QUOTE_ID,
                usedByRef: "order:1:fx",
                at: new Date("2026-02-14T00:00:00Z"),
            }),
        ).rejects.toThrow(NotFoundError);
    });

    it("returns quote as-is when markQuoteUsed is called for the same usedByRef", async () => {
        const quote = makeQuote({
            status: "used",
            usedByRef: "order:1:fx",
            usedAt: new Date("2026-02-14T00:00:00Z"),
        });

        const db = {
            select: vi.fn(() => selectWhereLimit([quote])),
            update: vi.fn(),
        } as any;
        const service = createTreasuryTestService({
            persistence: createPersistenceContext(db),
            feesService: createNoopFeesService(),
            currenciesService: createMockCurrenciesService(),
        });

        const result = await service.quotes.markQuoteUsed({
            quoteId: QUOTE_ID,
            usedByRef: "order:1:fx",
            at: new Date("2026-02-14T00:01:00Z"),
        });

        expect(result).toEqual(quote);
        expect(db.update).not.toHaveBeenCalled();
    });

    it("throws ValidationError when markQuoteUsed is called for a quote used by another ref", async () => {
        const quote = makeQuote({
            status: "used",
            usedByRef: "order:1:fx",
            usedAt: new Date("2026-02-14T00:00:00Z"),
        });

        const db = {
            select: vi.fn(() => selectWhereLimit([quote])),
            update: vi.fn(),
        } as any;
        const service = createTreasuryTestService({
            persistence: createPersistenceContext(db),
            feesService: createNoopFeesService(),
            currenciesService: createMockCurrenciesService(),
        });

        await expect(
            service.quotes.markQuoteUsed({
                quoteId: QUOTE_ID,
                usedByRef: "order:2:fx",
                at: new Date("2026-02-14T00:01:00Z"),
            }),
        ).rejects.toThrow(ValidationError);
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
        const service = createTreasuryTestService({
            persistence: createPersistenceContext(db),
            feesService: createNoopFeesService(),
            currenciesService: createMockCurrenciesService(),
        });

        await expect(
            service.quotes.markQuoteUsed({
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
        const service = createTreasuryTestService({
            persistence: createPersistenceContext(db),
            feesService: createNoopFeesService(),
            currenciesService: createMockCurrenciesService(),
        });

        const result = await service.quotes.markQuoteUsed({
            quoteId: QUOTE_ID,
            usedByRef: "order:4:fx",
            at: new Date("2026-02-14T00:01:00Z"),
        });

        expect(result.status).toBe("used");
        expect(result.usedByRef).toBe("order:4:fx");
    });
});
