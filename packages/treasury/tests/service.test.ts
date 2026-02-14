import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTreasuryService } from "../src/service";
import { createFeesService } from "@bedrock/fees";
import {
    NotFoundError,
    InvalidStateError,
    CurrencyMismatchError,
    AmountMismatchError,
    ValidationError,
} from "../src/errors";
import {
    createStubDb,
    createMockLedger,
    createMockOrder,
    CUSTOMER_ID,
    ORDER_ID,
    BRANCH_ORG_ID,
    type StubDatabase,
} from "./helpers";

describe("createTreasuryService", () => {
    let db: StubDatabase;
    let ledger: ReturnType<typeof createMockLedger>;
    let service: ReturnType<typeof createTreasuryService>;

    function selectReturning(rows: any[]) {
        return {
            from: vi.fn(() => ({
                where: vi.fn(() => ({
                    limit: vi.fn(async () => rows),
                })),
            })),
        };
    }

    function updateReturning(rows: any[]) {
        return {
            set: vi.fn(() => ({
                where: vi.fn(() => ({
                    returning: vi.fn(async () => rows),
                })),
            })),
        };
    }

    beforeEach(() => {
        db = createStubDb();
        ledger = createMockLedger();
        const feesService = createFeesService({ db });
        service = createTreasuryService({
            db,
            ledger,
            feesService,
        });
    });

    describe("fundingSettled", () => {
        const validInput = {
            orderId: ORDER_ID,
            branchOrgId: BRANCH_ORG_ID,
            branchBankStableKey: "bank-key-123",
            customerId: CUSTOMER_ID,
            currency: "USD",
            amountMinor: 100000n,
            railRef: "rail-ref-123",
            occurredAt: new Date(),
        };

        it("should process funding settled successfully", async () => {
            const order = createMockOrder({
                status: "quote",
                payInCurrency: "USD",
                payInExpectedMinor: 100000n,
            });

            // Setup mock for transaction
            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi.fn(() => ({
                        from: vi.fn(() => ({
                            where: vi.fn(() => ({
                                limit: vi.fn(async () => [order])
                            }))
                        }))
                    })),
                    update: vi.fn(() => ({
                        set: vi.fn(() => ({
                            where: vi.fn(() => ({
                                returning: vi.fn(async () => [{ id: ORDER_ID }])
                            }))
                        }))
                    }))
                };
                return fn(tx);
            });

            const result = await service.fundingSettled(validInput);

            expect(result).toBe("test-entry-id");
            expect(ledger.createEntryTx).toHaveBeenCalled();
        });

        it("should throw NotFoundError when order not found", async () => {
            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi.fn(() => ({
                        from: vi.fn(() => ({
                            where: vi.fn(() => ({
                                limit: vi.fn(async () => [])
                            }))
                        }))
                    }))
                };
                return fn(tx);
            });

            await expect(service.fundingSettled(validInput))
                .rejects.toThrow(NotFoundError);
        });

        it("should throw CurrencyMismatchError when currency doesn't match", async () => {
            const order = createMockOrder({
                payInCurrency: "EUR", // Different from input
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi.fn(() => ({
                        from: vi.fn(() => ({
                            where: vi.fn(() => ({
                                limit: vi.fn(async () => [order])
                            }))
                        }))
                    }))
                };
                return fn(tx);
            });

            await expect(service.fundingSettled(validInput))
                .rejects.toThrow(CurrencyMismatchError);
        });

        it("should throw AmountMismatchError when amount doesn't match", async () => {
            const order = createMockOrder({
                payInCurrency: "USD",
                payInExpectedMinor: 50000n, // Different from input
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi.fn(() => ({
                        from: vi.fn(() => ({
                            where: vi.fn(() => ({
                                limit: vi.fn(async () => [order])
                            }))
                        }))
                    }))
                };
                return fn(tx);
            });

            await expect(service.fundingSettled(validInput))
                .rejects.toThrow(AmountMismatchError);
        });

        it("should throw ValidationError when customerId doesn't match", async () => {
            const order = createMockOrder({
                payInCurrency: "USD",
                payInExpectedMinor: 100000n,
                customerId: "550e8400-e29b-41d4-a716-446655440099", // Different
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi.fn(() => ({
                        from: vi.fn(() => ({
                            where: vi.fn(() => ({
                                limit: vi.fn(async () => [order])
                            }))
                        }))
                    }))
                };
                return fn(tx);
            });

            await expect(service.fundingSettled(validInput))
                .rejects.toThrow(ValidationError);
        });

        it("should be idempotent when order is already advanced", async () => {
            const order = createMockOrder({
                payInCurrency: "USD",
                payInExpectedMinor: 100000n,
                status: "funding_settled",
                ledgerEntryId: "existing-entry-id",
            });
            vi.mocked(ledger.createEntryTx).mockResolvedValueOnce({
                entryId: "existing-entry-id",
                transferIds: new Map<number, bigint>(),
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi.fn(() => ({
                        from: vi.fn(() => ({
                            where: vi.fn(() => ({
                                limit: vi.fn(async () => [order])
                            }))
                        }))
                    })),
                    update: vi.fn(() => ({
                        set: vi.fn(() => ({
                            where: vi.fn(() => ({
                                returning: vi.fn(async () => []) // No rows updated
                            }))
                        }))
                    }))
                };
                return fn(tx);
            });

            const result = await service.fundingSettled(validInput);

            // Should return existing entry ID (idempotent)
            expect(result).toBe("existing-entry-id");
        });

        it("should throw InvalidStateError when order advanced with different ledger entry id", async () => {
            const order = createMockOrder({
                payInCurrency: "USD",
                payInExpectedMinor: 100000n,
                status: "funding_settled",
                ledgerEntryId: "different-entry-id",
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi.fn(() => ({
                        from: vi.fn(() => ({
                            where: vi.fn(() => ({
                                limit: vi.fn(async () => [order]),
                            })),
                        })),
                    })),
                    update: vi.fn(() => ({
                        set: vi.fn(() => ({
                            where: vi.fn(() => ({
                                returning: vi.fn(async () => []),
                            })),
                        })),
                    })),
                };
                return fn(tx);
            });

            await expect(service.fundingSettled(validInput)).rejects.toThrow(InvalidStateError);
        });

        it("should throw ValidationError when branchOrgId doesn't match order payInOrgId", async () => {
            const order = createMockOrder({
                payInCurrency: "USD",
                payInExpectedMinor: 100000n,
                payInOrgId: "550e8400-e29b-41d4-a716-446655440099",
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi.fn(() => ({
                        from: vi.fn(() => ({
                            where: vi.fn(() => ({
                                limit: vi.fn(async () => [order]),
                            })),
                        })),
                    })),
                };
                return fn(tx);
            });

            await expect(service.fundingSettled(validInput)).rejects.toThrow(ValidationError);
        });

        it("should throw InvalidStateError when CAS fails and order is in non-advanceable state", async () => {
            // Order is in "quote" initially, CAS update fails, and re-fetch shows still "quote"
            // This should throw because "quote" is not in advancedStatuses
            const order = createMockOrder({
                payInCurrency: "USD",
                payInExpectedMinor: 100000n,
                status: "quote",
            });

            const current = createMockOrder({
                payInCurrency: "USD",
                payInExpectedMinor: 100000n,
                status: "quote", // Still in quote - neither advanced nor advanceable
                ledgerEntryId: null,
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi
                        .fn()
                        .mockImplementationOnce(() => selectReturning([order]))
                        .mockImplementationOnce(() => selectReturning([current])),
                    update: vi.fn(() => updateReturning([])), // CAS failure
                };
                return fn(tx);
            });

            await expect(service.fundingSettled(validInput))
                .rejects.toThrow(InvalidStateError);
        });
    });

    describe("executeFx", () => {
        const validInput = {
            orderId: ORDER_ID,
            branchOrgId: BRANCH_ORG_ID,
            customerId: CUSTOMER_ID,
            payInCurrency: "USD",
            principalMinor: 100000n,
            feeMinor: 500n,
            spreadMinor: 200n,
            payOutCurrency: "EUR",
            payOutAmountMinor: 85000n,
            occurredAt: new Date(),
            quoteRef: "quote-ref-123",
        };

        function createFxQuote(overrides: Record<string, any> = {}) {
            return {
                id: "550e8400-e29b-41d4-a716-446655440010",
                idempotencyKey: validInput.quoteRef,
                fromCurrency: validInput.payInCurrency,
                toCurrency: validInput.payOutCurrency,
                fromAmountMinor: validInput.principalMinor,
                toAmountMinor: validInput.payOutAmountMinor,
                feeFromMinor: validInput.feeMinor,
                spreadFromMinor: validInput.spreadMinor,
                status: "active",
                usedByRef: null,
                usedAt: null,
                expiresAt: new Date(validInput.occurredAt.getTime() + 60_000),
                ...overrides,
            };
        }

        function selectSequence(rowsByCall: any[][]) {
            const select = vi.fn();
            for (const rows of rowsByCall) {
                select.mockImplementationOnce(() => selectReturning(rows));
            }
            // Any additional selects default to empty result set.
            select.mockImplementation(() => selectReturning([]));
            return select;
        }

        function updateSequence(rowsByCall: any[][]) {
            const update = vi.fn();
            for (const rows of rowsByCall) {
                update.mockReturnValueOnce(updateReturning(rows));
            }
            return update;
        }

        it("should execute FX successfully", async () => {
            const order = createMockOrder({
                status: "funding_settled",
                payInCurrency: "USD",
                payInExpectedMinor: 100000n,
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
            });
            const quote = createFxQuote();

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: selectSequence([[order], [quote]]),
                    update: updateSequence([
                        [{ id: quote.id, status: "used", usedByRef: `order:${ORDER_ID}:fx` }],
                        [{ id: ORDER_ID }],
                    ]),
                };
                return fn(tx);
            });

            const result = await service.executeFx(validInput);

            expect(result).toBe("test-entry-id");
            expect(ledger.createEntryTx).toHaveBeenCalled();
        });

        it("should post intercompany legs against order pay-in/pay-out orgs when they differ", async () => {
            const payInOrgId = "550e8400-e29b-41d4-a716-446655440011";
            const payOutOrgId = "550e8400-e29b-41d4-a716-446655440012";
            const order = createMockOrder({
                status: "funding_settled",
                payInCurrency: "USD",
                payInExpectedMinor: 100000n,
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
                payInOrgId,
                payOutOrgId,
            });
            const quote = createFxQuote();

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: selectSequence([[order], [quote]]),
                    update: updateSequence([
                        [{ id: quote.id, status: "used", usedByRef: `order:${ORDER_ID}:fx` }],
                        [{ id: ORDER_ID }],
                    ]),
                };
                return fn(tx);
            });

            await service.executeFx({ ...validInput, branchOrgId: payInOrgId });

            const transfers = vi.mocked(ledger.createEntryTx).mock.calls[0]![1].transfers;
            const payInCommit = transfers.find((t: any) => t.memo === "Commit pay-in to intercompany");
            const payoutObligation = transfers.find((t: any) => t.memo === "Create payout obligation");

            expect(payInCommit).toBeDefined();
            expect(payInCommit.creditKey).toContain(`:${payInOrgId}:USD`);
            expect(payoutObligation).toBeDefined();
            expect(payoutObligation.debitKey).toContain(`:${payOutOrgId}:EUR`);
        });

        it("should reject ambiguous UUID quoteRef between id and idempotency key", async () => {
            const order = createMockOrder({
                status: "funding_settled",
                payInCurrency: "USD",
                payInExpectedMinor: 100000n,
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
            });
            const uuidQuoteRef = "550e8400-e29b-41d4-a716-446655440099";
            const byId = createFxQuote({ id: uuidQuoteRef, idempotencyKey: "idem-1" });
            const byIdempotency = createFxQuote({ id: "quote-other", idempotencyKey: uuidQuoteRef });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: selectSequence([[order], [byId], [byIdempotency]]),
                    update: vi.fn(),
                };
                return fn(tx);
            });

            await expect(service.executeFx({ ...validInput, quoteRef: uuidQuoteRef }))
                .rejects.toThrow(ValidationError);
        });

        it("should throw NotFoundError when quote is missing", async () => {
            const order = createMockOrder({
                status: "funding_settled",
                payInCurrency: "USD",
                payInExpectedMinor: 100000n,
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: selectSequence([[order], []]),
                    update: vi.fn(),
                };
                return fn(tx);
            });

            await expect(service.executeFx(validInput))
                .rejects.toThrow(NotFoundError);
        });

        it.each([
            {
                label: "fromCurrency mismatch",
                overrides: { fromCurrency: "GBP" },
                error: CurrencyMismatchError,
            },
            {
                label: "toCurrency mismatch",
                overrides: { toCurrency: "USD" },
                error: CurrencyMismatchError,
            },
            {
                label: "fromAmountMinor mismatch",
                overrides: { fromAmountMinor: 999n },
                error: AmountMismatchError,
            },
            {
                label: "toAmountMinor mismatch",
                overrides: { toAmountMinor: 999n },
                error: AmountMismatchError,
            },
        ])("should reject quote with $label", async ({ overrides, error }) => {
            const order = createMockOrder({
                status: "funding_settled",
                payInCurrency: "USD",
                payInExpectedMinor: 100000n,
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
            });
            const quote = createFxQuote(overrides);

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: selectSequence([[order], [quote]]),
                    update: vi.fn(),
                };
                return fn(tx);
            });

            await expect(service.executeFx(validInput))
                .rejects.toThrow(error);
        });

        it("should throw AmountMismatchError when feeMinor mismatches resolved quote fee", async () => {
            const order = createMockOrder({
                status: "funding_settled",
                payInCurrency: "USD",
                payInExpectedMinor: 100000n,
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
            });
            const quote = createFxQuote({ feeFromMinor: 499n });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: selectSequence([[order], [quote]]),
                    update: updateSequence([[{ id: quote.id, status: "used", usedByRef: `order:${ORDER_ID}:fx` }]]),
                };
                return fn(tx);
            });

            await expect(service.executeFx(validInput))
                .rejects.toThrow(AmountMismatchError);
        });

        it("should reject quotes that are not active", async () => {
            const order = createMockOrder({
                status: "funding_settled",
                payInCurrency: "USD",
                payInExpectedMinor: 100000n,
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
            });
            const quote = createFxQuote({ status: "cancelled" });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: selectSequence([[order], [quote]]),
                    update: vi.fn(),
                };
                return fn(tx);
            });

            await expect(service.executeFx(validInput))
                .rejects.toThrow(InvalidStateError);
        });

        it("should throw NotFoundError when order not found", async () => {
            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi.fn(() => ({
                        from: vi.fn(() => ({
                            where: vi.fn(() => ({
                                limit: vi.fn(async () => [])
                            }))
                        }))
                    }))
                };
                return fn(tx);
            });

            await expect(service.executeFx(validInput))
                .rejects.toThrow(NotFoundError);
        });

        it("should throw InvalidStateError when order is not funding_settled", async () => {
            const order = createMockOrder({
                status: "quote",
                payInCurrency: "USD",
                payInExpectedMinor: 100000n,
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi.fn(() => ({
                        from: vi.fn(() => ({
                            where: vi.fn(() => ({
                                limit: vi.fn(async () => [order])
                            }))
                        }))
                    }))
                };
                return fn(tx);
            });

            await expect(service.executeFx(validInput))
                .rejects.toThrow(InvalidStateError);
        });

        it("should throw CurrencyMismatchError when payInCurrency doesn't match", async () => {
            const order = createMockOrder({
                status: "funding_settled",
                payInCurrency: "EUR",
                payInExpectedMinor: 100000n,
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi.fn(() => selectReturning([order])),
                };
                return fn(tx);
            });

            await expect(service.executeFx(validInput))
                .rejects.toThrow(CurrencyMismatchError);
        });

        it("should throw CurrencyMismatchError when payOutCurrency doesn't match", async () => {
            const order = createMockOrder({
                status: "funding_settled",
                payInCurrency: "USD",
                payInExpectedMinor: 100000n,
                payOutCurrency: "GBP",
                payOutAmountMinor: 85000n,
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi.fn(() => selectReturning([order])),
                };
                return fn(tx);
            });

            await expect(service.executeFx(validInput))
                .rejects.toThrow(CurrencyMismatchError);
        });

        it("should throw AmountMismatchError when principalMinor doesn't match", async () => {
            const order = createMockOrder({
                status: "funding_settled",
                payInCurrency: "USD",
                payInExpectedMinor: 50000n,
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi.fn(() => selectReturning([order])),
                };
                return fn(tx);
            });

            await expect(service.executeFx(validInput))
                .rejects.toThrow(AmountMismatchError);
        });

        it("should throw AmountMismatchError when payOutAmountMinor doesn't match", async () => {
            const order = createMockOrder({
                status: "funding_settled",
                payInCurrency: "USD",
                payInExpectedMinor: 100000n,
                payOutCurrency: "EUR",
                payOutAmountMinor: 42000n,
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi.fn(() => selectReturning([order])),
                };
                return fn(tx);
            });

            await expect(service.executeFx(validInput))
                .rejects.toThrow(AmountMismatchError);
        });

        it("should throw ValidationError when customerId doesn't match order", async () => {
            const order = createMockOrder({
                status: "funding_settled",
                payInCurrency: "USD",
                payInExpectedMinor: 100000n,
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
                customerId: "550e8400-e29b-41d4-a716-446655440099",
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi.fn(() => selectReturning([order])),
                };
                return fn(tx);
            });

            await expect(service.executeFx(validInput))
                .rejects.toThrow(ValidationError);
        });

        it("should throw ValidationError when branchOrgId doesn't match order branch orgs", async () => {
            const order = createMockOrder({
                status: "funding_settled",
                payInCurrency: "USD",
                payInExpectedMinor: 100000n,
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
                payInOrgId: "550e8400-e29b-41d4-a716-446655440099",
                payOutOrgId: "550e8400-e29b-41d4-a716-446655440098",
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi.fn(() => selectReturning([order])),
                };
                return fn(tx);
            });

            await expect(service.executeFx(validInput))
                .rejects.toThrow(ValidationError);
        });

        it("should reject expired FX quote", async () => {
            const order = createMockOrder({
                status: "funding_settled",
                payInCurrency: "USD",
                payInExpectedMinor: 100000n,
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
            });
            const quote = createFxQuote({
                expiresAt: new Date(Date.now() - 5_000),
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: selectSequence([[order], [quote]]),
                    update: vi.fn(),
                };
                return fn(tx);
            });

            await expect(service.executeFx(validInput)).rejects.toThrow(InvalidStateError);
            expect(ledger.createEntryTx).not.toHaveBeenCalled();
        });

        it("should reject quote already used by another order", async () => {
            const order = createMockOrder({
                status: "funding_settled",
                payInCurrency: "USD",
                payInExpectedMinor: 100000n,
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
            });
            const quote = createFxQuote({
                status: "used",
                usedByRef: "order:other-order:fx",
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: selectSequence([[order], [quote]]),
                    update: vi.fn(),
                };
                return fn(tx);
            });

            await expect(service.executeFx(validInput)).rejects.toThrow(InvalidStateError);
            expect(ledger.createEntryTx).not.toHaveBeenCalled();
        });

        it("should allow idempotent retries when quote is already used by same order", async () => {
            const order = createMockOrder({
                status: "funding_settled",
                payInCurrency: "USD",
                payInExpectedMinor: 100000n,
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
            });
            const quote = createFxQuote({
                status: "used",
                usedByRef: `order:${ORDER_ID}:fx`,
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: selectSequence([[order], [quote]]),
                    update: updateSequence([[{ id: ORDER_ID }]]),
                };
                return fn(tx);
            });

            const result = await service.executeFx(validInput);
            expect(result).toBe("test-entry-id");
        });

        it("should allow idempotent retry when quote update races but latest matches", async () => {
            const order = createMockOrder({
                status: "funding_settled",
                payInCurrency: "USD",
                payInExpectedMinor: 100000n,
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
            });
            const quote = createFxQuote();
            const latest = { id: quote.id, status: "used", usedByRef: `order:${ORDER_ID}:fx` };

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: selectSequence([[order], [quote], [latest]]),
                    update: updateSequence([
                        [], // quote update fails due to race
                        [{ id: ORDER_ID }],
                    ]),
                };
                return fn(tx);
            });

            const result = await service.executeFx(validInput);
            expect(result).toBe("test-entry-id");
        });

        it("should throw when quote update races and latest does not match", async () => {
            const order = createMockOrder({
                status: "funding_settled",
                payInCurrency: "USD",
                payInExpectedMinor: 100000n,
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
            });
            const quote = createFxQuote();
            const latest = { id: quote.id, status: "used", usedByRef: "order:other-order:fx" };

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: selectSequence([[order], [quote], [latest]]),
                    update: updateSequence([
                        [], // quote update fails due to race
                    ]),
                };
                return fn(tx);
            });

            await expect(service.executeFx(validInput))
                .rejects.toThrow(InvalidStateError);
        });

        it("should be idempotent when CAS fails but order already has our entry", async () => {
            const order = createMockOrder({
                status: "funding_settled",
                payInCurrency: "USD",
                payInExpectedMinor: 100000n,
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
            });
            const quote = createFxQuote();

            const current = {
                status: "fx_executed_pending_posting",
                ledgerEntryId: "test-entry-id",
            };

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: selectSequence([[order], [quote], [current]]),
                    update: updateSequence([
                        [{ id: quote.id, status: "used", usedByRef: `order:${ORDER_ID}:fx` }],
                        [],
                    ]),
                };
                return fn(tx);
            });

            const result = await service.executeFx(validInput);
            expect(result).toBe("test-entry-id");
        });

        it("should throw InvalidStateError when CAS fails and order has different entry", async () => {
            const order = createMockOrder({
                status: "funding_settled",
                payInCurrency: "USD",
                payInExpectedMinor: 100000n,
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
            });
            const quote = createFxQuote();

            const current = {
                status: "fx_executed",
                ledgerEntryId: "different-entry-id",
            };

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: selectSequence([[order], [quote], [current]]),
                    update: updateSequence([
                        [{ id: quote.id, status: "used", usedByRef: `order:${ORDER_ID}:fx` }],
                        [],
                    ]),
                };
                return fn(tx);
            });

            await expect(service.executeFx(validInput))
                .rejects.toThrow(InvalidStateError);
        });

        it("should create fee transfer when feeMinor > 0", async () => {
            const order = createMockOrder({
                status: "funding_settled",
                payInCurrency: "USD",
                payInExpectedMinor: 100000n,
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
            });
            const quote = createFxQuote();

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: selectSequence([[order], [quote]]),
                    update: updateSequence([
                        [{ id: quote.id, status: "used", usedByRef: `order:${ORDER_ID}:fx` }],
                        [{ id: ORDER_ID }],
                    ]),
                };
                return fn(tx);
            });

            await service.executeFx(validInput);

            const createEntryCall = vi.mocked(ledger.createEntryTx).mock.calls[0];
            const transfers = createEntryCall![1].transfers;

            const feeTransfer = transfers.find((t: any) => t.memo === "Fee revenue");
            expect(feeTransfer).toBeDefined();
            expect(feeTransfer.amount).toBe(500n);
        });

        it("should skip fee transfer when feeMinor is 0", async () => {
            const order = createMockOrder({
                status: "funding_settled",
                payInCurrency: "USD",
                payInExpectedMinor: 100000n,
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
            });
            const quote = createFxQuote({
                feeFromMinor: 0n,
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: selectSequence([[order], [quote]]),
                    update: updateSequence([
                        [{ id: quote.id, status: "used", usedByRef: `order:${ORDER_ID}:fx` }],
                        [{ id: ORDER_ID }],
                    ]),
                };
                return fn(tx);
            });

            await service.executeFx({ ...validInput, feeMinor: 0n });

            const createEntryCall = vi.mocked(ledger.createEntryTx).mock.calls[0];
            const transfers = createEntryCall![1].transfers;

            const feeTransfer = transfers.find((t: any) => t.memo === "Fee revenue");
            expect(feeTransfer).toBeUndefined();
        });

        it("should create manual bank fee transfer in arbitrary currency", async () => {
            const order = createMockOrder({
                status: "funding_settled",
                payInCurrency: "USD",
                payInExpectedMinor: 100000n,
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
            });
            const quote = createFxQuote();

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: selectSequence([[order], [quote]]),
                    update: updateSequence([
                        [{ id: quote.id, status: "used", usedByRef: `order:${ORDER_ID}:fx` }],
                        [{ id: ORDER_ID }],
                    ]),
                };
                return fn(tx);
            });

            await service.executeFx({
                ...validInput,
                fees: [
                    {
                        kind: "bank_fee",
                        currency: "EUR",
                        amountMinor: 321n,
                        memo: "Bank fee revenue",
                    },
                ],
            });

            const createEntryCall = vi.mocked(ledger.createEntryTx).mock.calls[0];
            const transfers = createEntryCall![1].transfers;

            const manualBankFee = transfers.find((t: any) => t.memo === "Bank fee revenue");
            expect(manualBankFee).toBeDefined();
            expect(manualBankFee.currency).toBe("EUR");
            expect(manualBankFee.amount).toBe(321n);
        });

        it("should reserve separate-payment-order fees into clearing account", async () => {
            const order = createMockOrder({
                status: "funding_settled",
                payInCurrency: "USD",
                payInExpectedMinor: 100000n,
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
            });
            const quote = createFxQuote();

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: selectSequence([[order], [quote]]),
                    update: updateSequence([
                        [{ id: quote.id, status: "used", usedByRef: `order:${ORDER_ID}:fx` }],
                        [{ id: ORDER_ID }],
                    ]),
                };
                return fn(tx);
            });

            await service.executeFx({
                ...validInput,
                fees: [
                    {
                        kind: "bank_fee",
                        currency: "USD",
                        amountMinor: 77n,
                        settlementMode: "separate_payment_order",
                    },
                ],
            });

            const createEntryCall = vi.mocked(ledger.createEntryTx).mock.calls[0];
            const transfers = createEntryCall![1].transfers;

            const reserveTransfer = transfers.find((t: any) => t.memo === "Fee reserved for separate payment order");
            expect(reserveTransfer).toBeDefined();
            expect(reserveTransfer.amount).toBe(77n);
            expect(reserveTransfer.creditKey).toContain("Liability:FeeClearing:bank");
        });
    });

    describe("initiatePayout", () => {
        const validInput = {
            orderId: ORDER_ID,
            payoutOrgId: BRANCH_ORG_ID,
            payoutBankStableKey: "bank-key-456",
            payOutCurrency: "EUR",
            amountMinor: 85000n,
            railRef: "payout-rail-ref",
            occurredAt: new Date(),
        };

        it("should initiate payout successfully", async () => {
            const order = createMockOrder({
                status: "fx_executed",
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi.fn(() => ({
                        from: vi.fn(() => ({
                            where: vi.fn(() => ({
                                limit: vi.fn(async () => [order])
                            }))
                        }))
                    })),
                    update: vi.fn(() => ({
                        set: vi.fn(() => ({
                            where: vi.fn(() => ({
                                returning: vi.fn(async () => [{ id: ORDER_ID }])
                            }))
                        }))
                    }))
                };
                return fn(tx);
            });

            const result = await service.initiatePayout(validInput);

            expect(result.entryId).toBe("test-entry-id");
            expect(result.pendingTransferId).toBeDefined();
            expect(ledger.createEntryTx).toHaveBeenCalled();
        });

        it("should be idempotent if CAS update fails but order already advanced to our entry", async () => {
            const order = createMockOrder({
                status: "fx_executed",
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
            });

            const current = createMockOrder({
                status: "payout_initiated_pending_posting",
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
                ledgerEntryId: "test-entry-id",
                payoutPendingTransferId: 12345678901234567890n,
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi
                        .fn()
                        .mockImplementationOnce(() => selectReturning([order]))
                        .mockImplementationOnce(() => selectReturning([current])),
                    update: vi.fn(() => updateReturning([])), // CAS failure
                };
                return fn(tx);
            });

            const result = await service.initiatePayout(validInput);
            expect(result).toEqual({ entryId: "test-entry-id", pendingTransferId: 12345678901234567890n });
        });

        it("should throw InvalidStateError if CAS update fails and order did not advance to our entry", async () => {
            const order = createMockOrder({
                status: "fx_executed",
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
            });

            const current = createMockOrder({
                status: "payout_initiated_pending_posting",
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
                ledgerEntryId: "different-entry-id",
                payoutPendingTransferId: 12345678901234567890n,
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi
                        .fn()
                        .mockImplementationOnce(() => selectReturning([order]))
                        .mockImplementationOnce(() => selectReturning([current])),
                    update: vi.fn(() => updateReturning([])), // CAS failure
                };
                return fn(tx);
            });

            await expect(service.initiatePayout(validInput)).rejects.toThrow(InvalidStateError);
        });

        it("should throw InvalidStateError when order is not fx_executed", async () => {
            const order = createMockOrder({
                status: "funding_settled", // Wrong state
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi.fn(() => ({
                        from: vi.fn(() => ({
                            where: vi.fn(() => ({
                                limit: vi.fn(async () => [order])
                            }))
                        }))
                    }))
                };
                return fn(tx);
            });

            await expect(service.initiatePayout(validInput))
                .rejects.toThrow(InvalidStateError);
        });

        it("should throw CurrencyMismatchError when payOutCurrency doesn't match", async () => {
            const order = createMockOrder({
                status: "fx_executed",
                payOutCurrency: "GBP", // Different from input EUR
                payOutAmountMinor: 85000n,
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi.fn(() => selectReturning([order])),
                };
                return fn(tx);
            });

            await expect(service.initiatePayout(validInput))
                .rejects.toThrow(CurrencyMismatchError);
        });

        it("should throw AmountMismatchError when amountMinor doesn't match", async () => {
            const order = createMockOrder({
                status: "fx_executed",
                payOutCurrency: "EUR",
                payOutAmountMinor: 42000n, // Different from input 85000n
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi.fn(() => selectReturning([order])),
                };
                return fn(tx);
            });

            await expect(service.initiatePayout(validInput))
                .rejects.toThrow(AmountMismatchError);
        });

        it("should throw ValidationError when payoutOrgId doesn't match order", async () => {
            const order = createMockOrder({
                status: "fx_executed",
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
                payOutOrgId: "550e8400-e29b-41d4-a716-446655440099",
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi.fn(() => selectReturning([order])),
                };
                return fn(tx);
            });

            await expect(service.initiatePayout(validInput))
                .rejects.toThrow(ValidationError);
        });

        it("should throw InvalidStateError when idempotent retry but payoutPendingTransferId missing", async () => {
            const order = createMockOrder({
                status: "fx_executed",
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
            });

            const current = createMockOrder({
                status: "payout_initiated_pending_posting",
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
                ledgerEntryId: "test-entry-id",
                payoutPendingTransferId: null, // Missing!
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi
                        .fn()
                        .mockImplementationOnce(() => selectReturning([order]))
                        .mockImplementationOnce(() => selectReturning([current])),
                    update: vi.fn(() => updateReturning([])), // CAS failure
                };
                return fn(tx);
            });

            await expect(service.initiatePayout(validInput))
                .rejects.toThrow(InvalidStateError);
        });

        it("should use custom timeoutSeconds when provided", async () => {
            const order = createMockOrder({
                status: "fx_executed",
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi.fn(() => ({
                        from: vi.fn(() => ({
                            where: vi.fn(() => ({
                                limit: vi.fn(async () => [order])
                            }))
                        }))
                    })),
                    update: vi.fn(() => ({
                        set: vi.fn(() => ({
                            where: vi.fn(() => ({
                                returning: vi.fn(async () => [{ id: ORDER_ID }])
                            }))
                        }))
                    }))
                };
                return fn(tx);
            });

            await service.initiatePayout({ ...validInput, timeoutSeconds: 3600 });

            const createEntryCall = vi.mocked(ledger.createEntryTx).mock.calls[0];
            const transfer = createEntryCall![1].transfers[0];

            expect(transfer.pending.timeoutSeconds).toBe(3600);
        });
    });

    describe("settlePayout", () => {
        const validInput = {
            orderId: ORDER_ID,
            payOutCurrency: "EUR",
            railRef: "settle-rail-ref",
            occurredAt: new Date(),
        };

        it("should settle payout successfully", async () => {
            const order = createMockOrder({
                status: "payout_initiated",
                payOutCurrency: "EUR",
                payoutPendingTransferId: 12345n,
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi.fn(() => ({
                        from: vi.fn(() => ({
                            where: vi.fn(() => ({
                                limit: vi.fn(async () => [order])
                            }))
                        }))
                    })),
                    update: vi.fn(() => ({
                        set: vi.fn(() => ({
                            where: vi.fn(() => ({
                                returning: vi.fn(async () => [{ id: ORDER_ID }])
                            }))
                        }))
                    }))
                };
                return fn(tx);
            });

            const result = await service.settlePayout(validInput);

            expect(result).toBe("test-entry-id");
            expect(ledger.createEntryTx).toHaveBeenCalled();
        });

        it("should be idempotent if CAS update fails but order already advanced to our entry", async () => {
            const order = createMockOrder({
                status: "payout_initiated",
                payOutCurrency: "EUR",
                payoutPendingTransferId: 12345n,
            });

            const current = createMockOrder({
                status: "closed_pending_posting",
                payOutCurrency: "EUR",
                payoutPendingTransferId: 12345n,
                ledgerEntryId: "test-entry-id",
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi
                        .fn()
                        .mockImplementationOnce(() => selectReturning([order]))
                        .mockImplementationOnce(() => selectReturning([current])),
                    update: vi.fn(() => updateReturning([])), // CAS failure
                };
                return fn(tx);
            });

            const result = await service.settlePayout(validInput);
            expect(result).toBe("test-entry-id");
        });

        it("should throw InvalidStateError if CAS update fails and order did not advance to our entry", async () => {
            const order = createMockOrder({
                status: "payout_initiated",
                payOutCurrency: "EUR",
                payoutPendingTransferId: 12345n,
            });

            const current = createMockOrder({
                status: "closed_pending_posting",
                payOutCurrency: "EUR",
                payoutPendingTransferId: 12345n,
                ledgerEntryId: "different-entry-id",
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi
                        .fn()
                        .mockImplementationOnce(() => selectReturning([order]))
                        .mockImplementationOnce(() => selectReturning([current])),
                    update: vi.fn(() => updateReturning([])), // CAS failure
                };
                return fn(tx);
            });

            await expect(service.settlePayout(validInput)).rejects.toThrow(InvalidStateError);
        });

        it("should throw InvalidStateError when order is not payout_initiated", async () => {
            const order = createMockOrder({
                status: "fx_executed", // Wrong state
                payOutCurrency: "EUR",
                payoutPendingTransferId: 12345n,
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi.fn(() => ({
                        from: vi.fn(() => ({
                            where: vi.fn(() => ({
                                limit: vi.fn(async () => [order])
                            }))
                        }))
                    }))
                };
                return fn(tx);
            });

            await expect(service.settlePayout(validInput))
                .rejects.toThrow(InvalidStateError);
        });

        it("should throw CurrencyMismatchError when payOutCurrency doesn't match", async () => {
            const order = createMockOrder({
                status: "payout_initiated",
                payOutCurrency: "GBP", // Different from input EUR
                payoutPendingTransferId: 12345n,
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi.fn(() => selectReturning([order])),
                };
                return fn(tx);
            });

            await expect(service.settlePayout(validInput))
                .rejects.toThrow(CurrencyMismatchError);
        });

        it("should throw InvalidStateError when payoutPendingTransferId is missing", async () => {
            const order = createMockOrder({
                status: "payout_initiated",
                payOutCurrency: "EUR",
                payoutPendingTransferId: null, // Missing
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi.fn(() => ({
                        from: vi.fn(() => ({
                            where: vi.fn(() => ({
                                limit: vi.fn(async () => [order])
                            }))
                        }))
                    }))
                };
                return fn(tx);
            });

            await expect(service.settlePayout(validInput))
                .rejects.toThrow(InvalidStateError);
        });
    });

    describe("voidPayout", () => {
        const validInput = {
            orderId: ORDER_ID,
            payOutCurrency: "EUR",
            railRef: "void-rail-ref",
            occurredAt: new Date(),
        };

        it("should void payout successfully", async () => {
            const order = createMockOrder({
                status: "payout_initiated",
                payOutCurrency: "EUR",
                payoutPendingTransferId: 12345n,
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi.fn(() => ({
                        from: vi.fn(() => ({
                            where: vi.fn(() => ({
                                limit: vi.fn(async () => [order])
                            }))
                        }))
                    })),
                    update: vi.fn(() => ({
                        set: vi.fn(() => ({
                            where: vi.fn(() => ({
                                returning: vi.fn(async () => [{ id: ORDER_ID }])
                            }))
                        }))
                    }))
                };
                return fn(tx);
            });

            const result = await service.voidPayout(validInput);

            expect(result).toBe("test-entry-id");
            expect(ledger.createEntryTx).toHaveBeenCalled();
        });

        it("should be idempotent if CAS update fails but order already advanced to our entry", async () => {
            const order = createMockOrder({
                status: "payout_initiated",
                payOutCurrency: "EUR",
                payoutPendingTransferId: 12345n,
            });

            const current = createMockOrder({
                status: "failed_pending_posting",
                payOutCurrency: "EUR",
                payoutPendingTransferId: 12345n,
                ledgerEntryId: "test-entry-id",
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi
                        .fn()
                        .mockImplementationOnce(() => selectReturning([order]))
                        .mockImplementationOnce(() => selectReturning([current])),
                    update: vi.fn(() => updateReturning([])), // CAS failure
                };
                return fn(tx);
            });

            const result = await service.voidPayout(validInput);
            expect(result).toBe("test-entry-id");
        });

        it("should throw InvalidStateError if CAS update fails and order did not advance to our entry", async () => {
            const order = createMockOrder({
                status: "payout_initiated",
                payOutCurrency: "EUR",
                payoutPendingTransferId: 12345n,
            });

            const current = createMockOrder({
                status: "failed_pending_posting",
                payOutCurrency: "EUR",
                payoutPendingTransferId: 12345n,
                ledgerEntryId: "different-entry-id",
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi
                        .fn()
                        .mockImplementationOnce(() => selectReturning([order]))
                        .mockImplementationOnce(() => selectReturning([current])),
                    update: vi.fn(() => updateReturning([])), // CAS failure
                };
                return fn(tx);
            });

            await expect(service.voidPayout(validInput)).rejects.toThrow(InvalidStateError);
        });

        it("should throw InvalidStateError when order is not payout_initiated", async () => {
            const order = createMockOrder({
                status: "closed", // Wrong state
                payOutCurrency: "EUR",
                payoutPendingTransferId: 12345n,
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi.fn(() => ({
                        from: vi.fn(() => ({
                            where: vi.fn(() => ({
                                limit: vi.fn(async () => [order])
                            }))
                        }))
                    }))
                };
                return fn(tx);
            });

            await expect(service.voidPayout(validInput))
                .rejects.toThrow(InvalidStateError);
        });

        it("should throw CurrencyMismatchError when payOutCurrency doesn't match", async () => {
            const order = createMockOrder({
                status: "payout_initiated",
                payOutCurrency: "GBP", // Different from input EUR
                payoutPendingTransferId: 12345n,
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi.fn(() => selectReturning([order])),
                };
                return fn(tx);
            });

            await expect(service.voidPayout(validInput))
                .rejects.toThrow(CurrencyMismatchError);
        });
    });

    describe("keyspace", () => {
        it("should expose keyspace", () => {
            expect(service.keys).toBeDefined();
            expect(service.keys.customerWallet).toBeDefined();
            expect(service.keys.bank).toBeDefined();
        });

        it("should generate correct account keys", () => {
            const K = service.keys;
            expect(K.customerWallet("cust-1", "USD")).toContain("CustomerWallet");
            expect(K.bank("org-1", "bank-1", "USD")).toContain("Bank");
            expect(K.payoutObligation("order-1", "EUR")).toContain("PayoutObligation");
        });
    });
});
