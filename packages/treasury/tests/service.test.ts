import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTreasuryService } from "../src/service";
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
    TREASURY_ORG_ID,
    CUSTOMER_ID,
    ORDER_ID,
    BRANCH_ORG_ID,
    type StubDatabase,
} from "./helpers";

describe("createTreasuryService", () => {
    let db: StubDatabase;
    let ledger: ReturnType<typeof createMockLedger>;
    let service: ReturnType<typeof createTreasuryService>;

    beforeEach(() => {
        db = createStubDb();
        ledger = createMockLedger();
        service = createTreasuryService({
            db,
            ledger,
            treasuryOrgId: TREASURY_ORG_ID,
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

        it("should execute FX successfully", async () => {
            const order = createMockOrder({
                status: "funding_settled",
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

            const result = await service.executeFx(validInput);

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

            await expect(service.executeFx(validInput))
                .rejects.toThrow(NotFoundError);
        });

        it("should throw InvalidStateError when order is not funding_settled", async () => {
            const order = createMockOrder({
                status: "quote", // Wrong state
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

        it("should create fee transfer when feeMinor > 0", async () => {
            const order = createMockOrder({
                status: "funding_settled",
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

            await service.executeFx(validInput);

            const createEntryCall = vi.mocked(ledger.createEntryTx).mock.calls[0];
            const transfers = createEntryCall![1].transfers;

            // Should have fee transfer
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

            await service.executeFx({ ...validInput, feeMinor: 0n });

            const createEntryCall = vi.mocked(ledger.createEntryTx).mock.calls[0];
            const transfers = createEntryCall![1].transfers;

            // Should NOT have fee transfer
            const feeTransfer = transfers.find((t: any) => t.memo === "Fee revenue");
            expect(feeTransfer).toBeUndefined();
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
