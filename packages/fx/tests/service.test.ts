import { describe, expect, it, vi } from "vitest";
import { schema } from "@bedrock/db/schema";
import { ValidationError } from "@bedrock/kernel/errors";
import { createFxService } from "../src/service";

const POLICY_ID = "550e8400-e29b-41d4-a716-446655440001";
const QUOTE_ID = "550e8400-e29b-41d4-a716-446655440010";

function selectWhereLimit(rows: any[]) {
    return {
        from: vi.fn(() => ({
            where: vi.fn(() => ({
                limit: vi.fn(async () => rows),
                orderBy: vi.fn(() => ({
                    limit: vi.fn(async () => rows),
                })),
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

function makePolicy(overrides: Record<string, unknown> = {}) {
    return {
        id: POLICY_ID,
        name: "Default",
        marginBps: 0,
        feeBps: 0,
        ttlSeconds: 120,
        isActive: true,
        createdAt: new Date("2026-02-14T00:00:00Z"),
        ...overrides,
    };
}

function makeQuote(overrides: Record<string, unknown> = {}) {
    return {
        id: QUOTE_ID,
        policyId: POLICY_ID,
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
        const dbSelect = vi
            .fn()
            .mockImplementationOnce(() => selectWhereLimit([makePolicy()]));
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
            throw new Error("unexpected insert table");
        });
        const db = {
            select: dbSelect,
            transaction: vi.fn(async (fn: any) => fn({ insert: txInsert })),
        } as any;
        const feesService = {
            calculateFxQuoteFeeComponents: vi.fn(async () => [{
                id: "rule:fee-1",
                kind: "fx_fee",
                currency: "RUB",
                amountMinor: 1_000n,
                source: "policy",
                settlementMode: "in_ledger",
            }]),
            saveQuoteFeeComponents: vi.fn(async () => undefined),
            getQuoteFeeComponents: vi.fn(async () => []),
        } as any;
        const service = createFxService({ db, feesService });

        const quote = await service.quote({
            mode: "explicit_route",
            idempotencyKey: "idem-route-1",
            policyId: POLICY_ID,
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
            fromCurrency: "RUB",
            toCurrency: "USDT",
            fromAmountMinor: 1_000_000n,
            toAmountMinor: 10_000n,
        });
        expect(insertedLegRows[1]).toMatchObject({
            idx: 2,
            fromCurrency: "USDT",
            toCurrency: "AED",
            fromAmountMinor: 10_000n,
            toAmountMinor: 35_000n,
        });
        expect(feesService.saveQuoteFeeComponents).toHaveBeenCalledWith(
            expect.objectContaining({ quoteId: QUOTE_ID }),
            expect.objectContaining({ insert: expect.any(Function) })
        );
    });

    it("rejects explicit route with broken leg continuity", async () => {
        const db = {
            select: vi
                .fn()
                .mockImplementationOnce(() => selectWhereLimit([makePolicy()])),
            transaction: vi.fn(),
        } as any;
        const feesService = {
            calculateFxQuoteFeeComponents: vi.fn(async () => []),
            saveQuoteFeeComponents: vi.fn(async () => undefined),
            getQuoteFeeComponents: vi.fn(async () => []),
        } as any;
        const service = createFxService({ db, feesService });

        await expect(service.quote({
            mode: "explicit_route",
            idempotencyKey: "idem-route-bad",
            policyId: POLICY_ID,
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
        const db = {
            select: vi
                .fn()
                .mockImplementationOnce(() => selectWhereLimit([makePolicy()]))
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
            })),
        } as any;
        const feesService = {
            calculateFxQuoteFeeComponents: vi.fn(async () => []),
            saveQuoteFeeComponents: vi.fn(async () => undefined),
            getQuoteFeeComponents: vi.fn(async () => []),
        } as any;
        const service = createFxService({ db, feesService });

        const quote = await service.quote({
            mode: "auto_cross",
            idempotencyKey: "idem-auto-1",
            policyId: POLICY_ID,
            fromCurrency: "USD",
            toCurrency: "EUR",
            fromAmountMinor: 10_000n,
            asOf: new Date("2026-02-14T00:00:00Z"),
        });

        expect(quote).toEqual(createdQuote);
        expect(insertedLegRows).toHaveLength(1);
        expect(insertedLegRows[0]).toMatchObject({
            idx: 1,
            fromCurrency: "USD",
            toCurrency: "EUR",
            fromAmountMinor: 10_000n,
            toAmountMinor: 20_000n,
            sourceKind: "derived",
        });
    });

    it("returns existing quote on idempotency race without duplicating side effects", async () => {
        const existingQuote = makeQuote({ idempotencyKey: "idem-race-1" });
        const insertLegs = vi.fn();
        const txSelect = vi.fn().mockImplementationOnce(() => selectWhereLimit([existingQuote]));
        const db = {
            select: vi
                .fn()
                .mockImplementationOnce(() => selectWhereLimit([makePolicy()])),
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
        const service = createFxService({ db, feesService });

        const quote = await service.quote({
            mode: "explicit_route",
            idempotencyKey: "idem-race-1",
            policyId: POLICY_ID,
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
                fromCurrency: "RUB",
                toCurrency: "USDT",
                fromAmountMinor: 1_000_000n,
                toAmountMinor: 10_000n,
                rateNum: 1n,
                rateDen: 100n,
                sourceKind: "bank",
                sourceRef: "bank-book",
                asOf: new Date("2026-02-14T00:00:00Z"),
                executionOrgId: null,
                createdAt: new Date("2026-02-14T00:00:00Z"),
            },
        ];
        const feeComponents = [{
            id: "quote_component:1",
            kind: "bank_fee",
            currency: "RUB",
            amountMinor: 300n,
            source: "policy",
            settlementMode: "in_ledger",
        }];
        const db = {
            select: vi
                .fn()
                .mockImplementationOnce(() => selectWhereLimit([quote]))
                .mockImplementationOnce(() => selectWhereOrderBy(legs)),
        } as any;
        const feesService = {
            calculateFxQuoteFeeComponents: vi.fn(async () => []),
            saveQuoteFeeComponents: vi.fn(async () => undefined),
            getQuoteFeeComponents: vi.fn(async () => feeComponents),
        } as any;
        const service = createFxService({ db, feesService });

        const details = await service.getQuoteDetails({ quoteRef: "idem-details-1" });

        expect(details.quote).toEqual(quote);
        expect(details.legs).toEqual(legs);
        expect(details.feeComponents).toEqual(feeComponents);
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
        const service = createFxService({ db, feesService });

        await expect(service.getQuoteDetails({ quoteRef: uuidQuoteRef })).rejects.toThrow(ValidationError);
    });
});
