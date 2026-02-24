import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTransfersService } from "../src/service";
import {
    NotFoundError,
    InvalidStateError,
    PermissionError,
    ValidationError,
} from "../src/errors";
import {
    createStubDb,
    createMockLedger,
    createMockTransfer,
    setupTxWithTransfer,
    setupTxWithUpdateSuccess,
    setupTxWithUpdateFailure,
    COUNTERPARTY_ID,
    TRANSFER_ID,
    MAKER_USER_ID,
    CHECKER_USER_ID,
    type StubDatabase,
} from "./helpers";
import { TransferStatus } from "@bedrock/db/schema";

function createMockCurrenciesService() {
    const byCode = new Map<string, any>([
        ["USD", { id: "cur-usd", code: "USD" }],
        ["EUR", { id: "cur-eur", code: "EUR" }],
        ["GBP", { id: "cur-gbp", code: "GBP" }],
    ]);
    const byId = new Map<string, any>(Array.from(byCode.values()).map((currency) => [currency.id, currency]));

    return {
        findByCode: vi.fn(async (code: string) => {
            const normalized = code.trim().toUpperCase();
            const existing = byCode.get(normalized);
            if (existing) return existing;
            const generated = { id: `cur-${normalized.toLowerCase()}`, code: normalized };
            byCode.set(normalized, generated);
            byId.set(generated.id, generated);
            return generated;
        }),
        findById: vi.fn(async (id: string) => {
            const existing = byId.get(id);
            if (existing) return existing;
            throw new Error(`Unknown currency id: ${id}`);
        }),
    };
}

describe("createTransfersService", () => {
    let db: StubDatabase;
    let ledger: ReturnType<typeof createMockLedger>;
    let service: ReturnType<typeof createTransfersService>;
    let canApprove: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        db = createStubDb();
        ledger = createMockLedger();
        canApprove = vi.fn(async () => true);
        const currenciesService = createMockCurrenciesService();
        service = createTransfersService({
            db,
            ledger,
            currenciesService,
            canApprove,
        });
    });

    describe("createDraft", () => {
        const validInput = {
            counterpartyId: COUNTERPARTY_ID,
            idempotencyKey: "test-key-123",
            fromAccountKey: "Account:org1:vault:USD",
            toAccountKey: "Account:org1:operating:USD",
            currency: "USD",
            amountMinor: 100000n,
            memo: "Test transfer",
            makerUserId: MAKER_USER_ID,
        };

        it("should create a draft transfer successfully", async () => {
            vi.mocked(db.insert).mockReturnValue({
                values: vi.fn(() => ({
                    onConflictDoNothing: vi.fn(() => ({
                        returning: vi.fn(async () => [{ id: TRANSFER_ID }]),
                    })),
                })),
            } as any);

            const result = await service.createDraft(validInput);

            expect(result).toBe(TRANSFER_ID);
            expect(db.insert).toHaveBeenCalled();
        });

        it("should return existing transfer on idempotency key conflict", async () => {
            // First insert returns nothing (conflict)
            vi.mocked(db.insert).mockReturnValue({
                values: vi.fn(() => ({
                    onConflictDoNothing: vi.fn(() => ({
                        returning: vi.fn(async () => []),
                    })),
                })),
            } as any);

            // Then select returns existing
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn(() => ({
                    where: vi.fn(() => ({
                        limit: vi.fn(async () => [{ id: TRANSFER_ID }]),
                    })),
                })),
            } as any);

            const result = await service.createDraft(validInput);

            expect(result).toBe(TRANSFER_ID);
        });

        it("should throw when idempotent conflict exists but record is missing", async () => {
            vi.mocked(db.insert).mockReturnValue({
                values: vi.fn(() => ({
                    onConflictDoNothing: vi.fn(() => ({
                        returning: vi.fn(async () => []),
                    })),
                })),
            } as any);

            vi.mocked(db.select).mockReturnValue({
                from: vi.fn(() => ({
                    where: vi.fn(() => ({
                        limit: vi.fn(async () => []),
                    })),
                })),
            } as any);

            await expect(service.createDraft(validInput)).rejects.toThrow(InvalidStateError);
        });

        it("should throw ValidationError for negative amount", async () => {
            const invalidInput = {
                ...validInput,
                amountMinor: -100n,
            };

            await expect(service.createDraft(invalidInput)).rejects.toThrow(ValidationError);
        });

        it("should throw ValidationError for same from and to account", async () => {
            const invalidInput = {
                ...validInput,
                fromAccountKey: "Account:org1:vault:USD",
                toAccountKey: "Account:org1:vault:USD",
            };

            await expect(service.createDraft(invalidInput)).rejects.toThrow(ValidationError);
        });

        it("should normalize currency to uppercase", async () => {
            const insertMock = vi.fn(() => ({
                onConflictDoNothing: vi.fn(() => ({
                    returning: vi.fn(async () => [{ id: TRANSFER_ID }]),
                })),
            }));
            
            vi.mocked(db.insert).mockReturnValue({
                values: insertMock,
            } as any);

            await service.createDraft({
                ...validInput,
                currency: "usd",
            });

            expect(insertMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    currencyId: "cur-usd",
                })
            );
        });
    });

    describe("approve", () => {
        const validInput = {
            counterpartyId: COUNTERPARTY_ID,
            transferId: TRANSFER_ID,
            checkerUserId: CHECKER_USER_ID,
            occurredAt: new Date(),
        };

        it("should approve a draft transfer successfully", async () => {
            const transfer = createMockTransfer({
                status: TransferStatus.DRAFT,
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi.fn(() => ({
                        from: vi.fn(() => ({
                            where: vi.fn(() => ({
                                limit: vi.fn(async () => [transfer]),
                            })),
                        })),
                    })),
                    update: vi.fn(() => ({
                        set: vi.fn(() => ({
                            where: vi.fn(() => ({
                                returning: vi.fn(async () => [{ id: TRANSFER_ID }]),
                            })),
                        })),
                    })),
                };
                return fn(tx);
            });

            const result = await service.approve(validInput);

            expect(result).toEqual({
                transferId: TRANSFER_ID,
                ledgerEntryId: "test-entry-id",
            });
            expect(ledger.createEntryTx).toHaveBeenCalled();
        });

        it("should throw NotFoundError when transfer does not exist", async () => {
            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi.fn(() => ({
                        from: vi.fn(() => ({
                            where: vi.fn(() => ({
                                limit: vi.fn(async () => []),
                            })),
                        })),
                    })),
                };
                return fn(tx);
            });

            await expect(service.approve(validInput)).rejects.toThrow(NotFoundError);
        });

        it("should throw InvalidStateError when transfer is not in draft", async () => {
            const transfer = createMockTransfer({
                status: TransferStatus.POSTED,
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi.fn(() => ({
                        from: vi.fn(() => ({
                            where: vi.fn(() => ({
                                limit: vi.fn(async () => [transfer]),
                            })),
                        })),
                    })),
                };
                return fn(tx);
            });

            await expect(service.approve(validInput)).rejects.toThrow(InvalidStateError);
        });

        it("should throw PermissionError when canApprove returns false", async () => {
            canApprove.mockResolvedValue(false);

            await expect(service.approve(validInput)).rejects.toThrow(PermissionError);
        });

        it("should handle idempotent retry when CAS fails but already approved", async () => {
            const transfer = createMockTransfer({
                status: TransferStatus.DRAFT,
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi.fn()
                        .mockReturnValueOnce({
                            from: vi.fn(() => ({
                                where: vi.fn(() => ({
                                    limit: vi.fn(async () => [transfer]),
                                })),
                            })),
                        })
                        .mockReturnValueOnce({
                            from: vi.fn(() => ({
                                where: vi.fn(() => ({
                                    limit: vi.fn(async () => [{
                                        status: TransferStatus.APPROVED_PENDING_POSTING,
                                        ledgerEntryId: "test-entry-id",
                                    }]),
                                })),
                            })),
                        }),
                    update: vi.fn(() => ({
                        set: vi.fn(() => ({
                            where: vi.fn(() => ({
                                returning: vi.fn(async () => []), // CAS fails
                            })),
                        })),
                    })),
                };
                return fn(tx);
            });

            const result = await service.approve(validInput);

            expect(result).toEqual({
                transferId: TRANSFER_ID,
                ledgerEntryId: "test-entry-id",
            });
        });

        it("should throw when CAS fails and transfer is not in an advanced status", async () => {
            const transfer = createMockTransfer({
                status: TransferStatus.DRAFT,
            });

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    select: vi.fn()
                        .mockReturnValueOnce({
                            from: vi.fn(() => ({
                                where: vi.fn(() => ({
                                    limit: vi.fn(async () => [transfer]),
                                })),
                            })),
                        })
                        .mockReturnValueOnce({
                            from: vi.fn(() => ({
                                where: vi.fn(() => ({
                                    limit: vi.fn(async () => [{
                                        status: TransferStatus.DRAFT,
                                        ledgerEntryId: "test-entry-id",
                                    }]),
                                })),
                            })),
                        }),
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

            await expect(service.approve(validInput)).rejects.toThrow(InvalidStateError);
        });
    });

    describe("reject", () => {
        const validInput = {
            counterpartyId: COUNTERPARTY_ID,
            transferId: TRANSFER_ID,
            checkerUserId: CHECKER_USER_ID,
            occurredAt: new Date(),
            reason: "Invalid transfer",
        };

        it("should reject a draft transfer successfully", async () => {
            vi.mocked(db.update).mockReturnValue({
                set: vi.fn(() => ({
                    where: vi.fn(() => ({
                        returning: vi.fn(async () => [{ id: TRANSFER_ID }]),
                    })),
                })),
            } as any);

            const result = await service.reject(validInput);

            expect(result).toBe(TRANSFER_ID);
            expect(db.update).toHaveBeenCalled();
        });

        it("should throw NotFoundError when transfer does not exist", async () => {
            vi.mocked(db.update).mockReturnValue({
                set: vi.fn(() => ({
                    where: vi.fn(() => ({
                        returning: vi.fn(async () => []),
                    })),
                })),
            } as any);

            vi.mocked(db.select).mockReturnValue({
                from: vi.fn(() => ({
                    where: vi.fn(() => ({
                        limit: vi.fn(async () => []),
                    })),
                })),
            } as any);

            await expect(service.reject(validInput)).rejects.toThrow(NotFoundError);
        });

        it("should throw InvalidStateError when transfer is not in draft", async () => {
            vi.mocked(db.update).mockReturnValue({
                set: vi.fn(() => ({
                    where: vi.fn(() => ({
                        returning: vi.fn(async () => []),
                    })),
                })),
            } as any);

            vi.mocked(db.select).mockReturnValue({
                from: vi.fn(() => ({
                    where: vi.fn(() => ({
                        limit: vi.fn(async () => [{ status: TransferStatus.POSTED }]),
                    })),
                })),
            } as any);

            await expect(service.reject(validInput)).rejects.toThrow(InvalidStateError);
        });

        it("should handle idempotent retry when already rejected", async () => {
            vi.mocked(db.update).mockReturnValue({
                set: vi.fn(() => ({
                    where: vi.fn(() => ({
                        returning: vi.fn(async () => []),
                    })),
                })),
            } as any);

            vi.mocked(db.select).mockReturnValue({
                from: vi.fn(() => ({
                    where: vi.fn(() => ({
                        limit: vi.fn(async () => [{ status: TransferStatus.REJECTED }]),
                    })),
                })),
            } as any);

            const result = await service.reject(validInput);

            expect(result).toBe(TRANSFER_ID);
        });

        it("should throw PermissionError when canApprove returns false", async () => {
            canApprove.mockResolvedValue(false);

            await expect(service.reject(validInput)).rejects.toThrow(PermissionError);
        });
    });

    describe("markFailed", () => {
        const validInput = {
            counterpartyId: COUNTERPARTY_ID,
            transferId: TRANSFER_ID,
            reason: "Journal posting failed",
        };

        it("should mark approved_pending_posting transfer as failed", async () => {
            vi.mocked(db.update).mockReturnValue({
                set: vi.fn(() => ({
                    where: vi.fn(() => ({
                        returning: vi.fn(async () => [{ id: TRANSFER_ID }]),
                    })),
                })),
            } as any);

            await service.markFailed(validInput);

            expect(db.update).toHaveBeenCalled();
        });

        it("should throw NotFoundError when transfer does not exist", async () => {
            vi.mocked(db.update).mockReturnValue({
                set: vi.fn(() => ({
                    where: vi.fn(() => ({
                        returning: vi.fn(async () => []),
                    })),
                })),
            } as any);

            vi.mocked(db.select).mockReturnValue({
                from: vi.fn(() => ({
                    where: vi.fn(() => ({
                        limit: vi.fn(async () => []),
                    })),
                })),
            } as any);

            await expect(service.markFailed(validInput)).rejects.toThrow(NotFoundError);
        });

        it("should throw InvalidStateError when transfer is not in allowed state", async () => {
            vi.mocked(db.update).mockReturnValue({
                set: vi.fn(() => ({
                    where: vi.fn(() => ({
                        returning: vi.fn(async () => []),
                    })),
                })),
            } as any);

            vi.mocked(db.select).mockReturnValue({
                from: vi.fn(() => ({
                    where: vi.fn(() => ({
                        limit: vi.fn(async () => [{ status: TransferStatus.DRAFT }]),
                    })),
                })),
            } as any);

            await expect(service.markFailed(validInput)).rejects.toThrow(InvalidStateError);
        });
    });
});
