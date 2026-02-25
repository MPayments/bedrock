import { describe, expect, it, vi, beforeEach } from "vitest";

import { createStubDb, mockInsertReturns, mockSelectReturns, type StubDatabase } from "@bedrock/test-utils";

import { InvalidStateError, MakerCheckerViolationError, TransferCurrencyMismatchError } from "../src/errors";
import { createTransfersService } from "../src/service";

const SOURCE_ACCOUNT_ID = "550e8400-e29b-41d4-a716-446655440001";
const DESTINATION_ACCOUNT_ID = "550e8400-e29b-41d4-a716-446655440002";
const TRANSFER_ID = "550e8400-e29b-41d4-a716-446655440010";
const MAKER_USER_ID = "550e8400-e29b-41d4-a716-446655440003";
const CHECKER_USER_ID = "550e8400-e29b-41d4-a716-446655440004";

function createTransfer(overrides: Record<string, unknown> = {}) {
    return {
        id: TRANSFER_ID,
        sourceCounterpartyId: "550e8400-e29b-41d4-a716-446655440111",
        destinationCounterpartyId: "550e8400-e29b-41d4-a716-446655440222",
        sourceAccountId: SOURCE_ACCOUNT_ID,
        destinationAccountId: DESTINATION_ACCOUNT_ID,
        currencyId: "550e8400-e29b-41d4-a716-446655440555",
        amountMinor: 1000n,
        kind: "cross_org",
        settlementMode: "pending",
        timeoutSeconds: 3600,
        status: "draft",
        memo: "test",
        makerUserId: MAKER_USER_ID,
        checkerUserId: null,
        approvedAt: null,
        rejectedAt: null,
        rejectReason: null,
        ledgerOperationId: null,
        sourcePendingTransferId: null,
        destinationPendingTransferId: null,
        idempotencyKey: "draft-key",
        lastError: null,
        createdAt: new Date("2026-02-25T00:00:00.000Z"),
        updatedAt: new Date("2026-02-25T00:00:00.000Z"),
        ...overrides,
    };
}

describe("createTransfersService (v2)", () => {
    let db: StubDatabase;
    let accountService: { resolveTransferBindings: ReturnType<typeof vi.fn> };
    let ledger: { createOperationTx: ReturnType<typeof vi.fn> };
    let service: ReturnType<typeof createTransfersService>;

    const sourceBinding = {
        accountId: SOURCE_ACCOUNT_ID,
        counterpartyId: "550e8400-e29b-41d4-a716-446655440111",
        currencyId: "550e8400-e29b-41d4-a716-446655440555",
        currencyCode: "USD",
        stableKey: "source-main",
        ledgerOrgId: "00000000-0000-4000-8000-000000000002",
        ledgerKey: "tr2:Account:550e8400-e29b-41d4-a716-446655440111:source-main:USD",
    };

    const destinationBinding = {
        accountId: DESTINATION_ACCOUNT_ID,
        counterpartyId: "550e8400-e29b-41d4-a716-446655440222",
        currencyId: "550e8400-e29b-41d4-a716-446655440555",
        currencyCode: "USD",
        stableKey: "destination-main",
        ledgerOrgId: "00000000-0000-4000-8000-000000000002",
        ledgerKey: "tr2:Account:550e8400-e29b-41d4-a716-446655440222:destination-main:USD",
    };

    beforeEach(() => {
        db = createStubDb();
        accountService = {
            resolveTransferBindings: vi.fn(async () => [sourceBinding, destinationBinding]),
        };
        ledger = {
            createOperationTx: vi.fn(async () => ({
                operationId: "550e8400-e29b-41d4-a716-446655440777",
                entryId: "550e8400-e29b-41d4-a716-446655440777",
                pendingTransferIdsByRef: new Map<string, bigint>(),
                transferIds: new Map([[1, 123n]]),
            })),
        };

        service = createTransfersService({
            db,
            ledger: ledger as any,
            accountService: accountService as any,
        });
    });

    it("creates a transfer draft from account IDs", async () => {
        mockInsertReturns(db.insert, [{ id: TRANSFER_ID }]);

        const transferId = await service.createDraft({
            sourceAccountId: SOURCE_ACCOUNT_ID,
            destinationAccountId: DESTINATION_ACCOUNT_ID,
            idempotencyKey: "draft-key",
            amountMinor: 1000n,
            makerUserId: MAKER_USER_ID,
            settlementMode: "pending",
            timeoutSeconds: 900,
            memo: "test",
        });

        expect(transferId).toBe(TRANSFER_ID);
        expect(accountService.resolveTransferBindings).toHaveBeenCalledWith({
            accountIds: [SOURCE_ACCOUNT_ID, DESTINATION_ACCOUNT_ID],
        });
    });

    it("rejects draft when source/destination currencies differ", async () => {
        accountService.resolveTransferBindings.mockResolvedValueOnce([
            sourceBinding,
            {
                ...destinationBinding,
                currencyId: "550e8400-e29b-41d4-a716-446655440556",
                currencyCode: "EUR",
            },
        ]);

        await expect(
            service.createDraft({
                sourceAccountId: SOURCE_ACCOUNT_ID,
                destinationAccountId: DESTINATION_ACCOUNT_ID,
                idempotencyKey: "draft-key",
                amountMinor: 1000n,
                makerUserId: MAKER_USER_ID,
            }),
        ).rejects.toThrow(TransferCurrencyMismatchError);
    });

    it("enforces maker/checker separation on approve", async () => {
        mockSelectReturns(db._tx.select, [
            createTransfer({
                status: "draft",
                makerUserId: CHECKER_USER_ID,
            }),
        ]);

        await expect(
            service.approve({
                transferId: TRANSFER_ID,
                checkerUserId: CHECKER_USER_ID,
                occurredAt: new Date("2026-02-25T00:00:00.000Z"),
            }),
        ).rejects.toThrow(MakerCheckerViolationError);
    });

    it("returns idempotent approve response when already posted", async () => {
        mockSelectReturns(db._tx.select, [
            createTransfer({
                status: "posted",
                ledgerOperationId: "550e8400-e29b-41d4-a716-446655440888",
            }),
        ]);

        const result = await service.approve({
            transferId: TRANSFER_ID,
            checkerUserId: CHECKER_USER_ID,
            occurredAt: new Date("2026-02-25T00:00:00.000Z"),
        });

        expect(result).toEqual({
            transferId: TRANSFER_ID,
            ledgerOperationId: "550e8400-e29b-41d4-a716-446655440888",
        });
        expect(ledger.createOperationTx).not.toHaveBeenCalled();
    });

    it("rejects voidPending when transfer is not in pending state", async () => {
        mockSelectReturns(db._tx.select, [
            createTransfer({
                status: "posted",
                settlementMode: "pending",
                sourcePendingTransferId: 123n,
            }),
        ]);

        await expect(
            service.voidPending({
                transferId: TRANSFER_ID,
                eventIdempotencyKey: "void-key",
                occurredAt: new Date("2026-02-25T00:00:00.000Z"),
            }, CHECKER_USER_ID),
        ).rejects.toThrow(InvalidStateError);
    });
});
