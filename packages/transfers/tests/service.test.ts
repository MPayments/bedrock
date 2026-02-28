import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  createStubDb,
  mockInsertReturns,
  mockSelectReturns,
  type StubDatabase,
} from "@bedrock/test-utils";

import {
  InsufficientFundsError,
  InvalidStateError,
  MakerCheckerViolationError,
  NotFoundError,
  PermissionError,
  TransferCurrencyMismatchError,
} from "../src/errors";
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
    sourceOperationalAccountId: SOURCE_ACCOUNT_ID,
    destinationOperationalAccountId: DESTINATION_ACCOUNT_ID,
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

function selectReturning(rows: unknown[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        for: vi.fn(() => ({
          limit: vi.fn(async () => rows),
        })),
        limit: vi.fn(async () => rows),
      })),
    })),
  };
}

function updateReturning(rows: unknown[]) {
  return {
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(async () => rows),
      })),
    })),
  };
}

function insertReturning(rows: unknown[]) {
  return {
    values: vi.fn(() => ({
      onConflictDoUpdate: vi.fn(() => ({
        returning: vi.fn(async () => rows),
      })),
      onConflictDoNothing: vi.fn(() => ({
        returning: vi.fn(async () => rows),
      })),
    })),
  };
}

function selectListReturning(rows: unknown[]) {
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

function selectCountReturning(rows: unknown[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(async () => rows),
    })),
  };
}

describe("createTransfersService (v2)", () => {
  let db: StubDatabase;
  let operationalAccountsService: {
    resolveTransferBindings: ReturnType<typeof vi.fn>;
  };
  let ledger: { commit: ReturnType<typeof vi.fn> };
  let service: ReturnType<typeof createTransfersService>;

  const sourceBinding = {
    accountId: SOURCE_ACCOUNT_ID,
    counterpartyId: "550e8400-e29b-41d4-a716-446655440111",
    currencyId: "550e8400-e29b-41d4-a716-446655440555",
    currencyCode: "USD",
    stableKey: "source-main",
    ledgerOrgId: "00000000-0000-4000-8000-000000000002",
    ledgerKey:
      "tr2:Account:550e8400-e29b-41d4-a716-446655440111:source-main:USD",
  };

  const destinationBinding = {
    accountId: DESTINATION_ACCOUNT_ID,
    counterpartyId: "550e8400-e29b-41d4-a716-446655440222",
    currencyId: "550e8400-e29b-41d4-a716-446655440555",
    currencyCode: "USD",
    stableKey: "destination-main",
    ledgerOrgId: "00000000-0000-4000-8000-000000000002",
    ledgerKey:
      "tr2:Account:550e8400-e29b-41d4-a716-446655440222:destination-main:USD",
  };

  beforeEach(() => {
    db = createStubDb();
    db._tx.execute.mockResolvedValue({ rows: [{ balance_minor: "1000000" }] });
    operationalAccountsService = {
      resolveTransferBindings: vi.fn(async () => [
        sourceBinding,
        destinationBinding,
      ]),
    };
    ledger = {
      commit: vi.fn(async () => ({
        operationId: "550e8400-e29b-41d4-a716-446655440777",
        entryId: "550e8400-e29b-41d4-a716-446655440777",
        pendingTransferIdsByRef: new Map<string, bigint>(),
        transferIds: new Map([[1, 123n]]),
      })),
    };

    service = createTransfersService({
      db,
      ledger: ledger as any,
      operationalAccountsService: operationalAccountsService as any,
    });
  });

  it("creates a transfer draft from account IDs", async () => {
    mockInsertReturns(db.insert, [
      {
        id: TRANSFER_ID,
        sourceOperationalAccountId: SOURCE_ACCOUNT_ID,
        destinationOperationalAccountId: DESTINATION_ACCOUNT_ID,
        currencyId: sourceBinding.currencyId,
        amountMinor: 1000n,
        kind: "cross_org",
        settlementMode: "pending",
        timeoutSeconds: 900,
        memo: "test",
        makerUserId: MAKER_USER_ID,
      },
    ]);

    const transferId = await service.createDraft({
      sourceOperationalAccountId: SOURCE_ACCOUNT_ID,
      destinationOperationalAccountId: DESTINATION_ACCOUNT_ID,
      idempotencyKey: "draft-key",
      amountMinor: 1000n,
      makerUserId: MAKER_USER_ID,
      settlementMode: "pending",
      timeoutSeconds: 900,
      memo: "test",
    });

    expect(transferId).toBe(TRANSFER_ID);
    expect(
      operationalAccountsService.resolveTransferBindings,
    ).toHaveBeenCalledWith({
      accountIds: [SOURCE_ACCOUNT_ID, DESTINATION_ACCOUNT_ID],
    });
  });

  it("rejects draft when source/destination currencies differ", async () => {
    operationalAccountsService.resolveTransferBindings.mockResolvedValueOnce([
      sourceBinding,
      {
        ...destinationBinding,
        currencyId: "550e8400-e29b-41d4-a716-446655440556",
        currencyCode: "EUR",
      },
    ]);

    await expect(
      service.createDraft({
        sourceOperationalAccountId: SOURCE_ACCOUNT_ID,
        destinationOperationalAccountId: DESTINATION_ACCOUNT_ID,
        idempotencyKey: "draft-key",
        amountMinor: 1000n,
        makerUserId: MAKER_USER_ID,
        settlementMode: "immediate",
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

  it("returns not found when approving unknown transfer", async () => {
    mockSelectReturns(db._tx.select, []);

    await expect(
      service.approve({
        transferId: TRANSFER_ID,
        checkerUserId: CHECKER_USER_ID,
        occurredAt: new Date("2026-02-25T00:00:00.000Z"),
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("rejects approve for non-draft non-idempotent status", async () => {
    mockSelectReturns(db._tx.select, [
      createTransfer({
        status: "failed",
        ledgerOperationId: null,
      }),
    ]);

    await expect(
      service.approve({
        transferId: TRANSFER_ID,
        checkerUserId: CHECKER_USER_ID,
        occurredAt: new Date("2026-02-25T00:00:00.000Z"),
      }),
    ).rejects.toThrow(InvalidStateError);
  });

  it("allows admin override for maker/checker on approve", async () => {
    const opId = "550e8400-e29b-41d4-a716-446655440991";
    ledger.commit.mockResolvedValueOnce({
      operationId: opId,
      pendingTransferIdsByRef: new Map<string, bigint>(),
    });

    vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
      const tx = {
        select: vi.fn(() =>
          selectReturning([
            createTransfer({
              status: "draft",
              makerUserId: CHECKER_USER_ID,
            }),
          ]),
        ),
        execute: vi.fn(async () => ({
          rows: [{ balance_minor: "1000000" }],
        })),
        update: vi.fn(() => updateReturning([{ id: TRANSFER_ID }])),
      };
      return fn(tx);
    });

    const result = await service.approve(
      {
        transferId: TRANSFER_ID,
        checkerUserId: CHECKER_USER_ID,
        occurredAt: new Date("2026-02-25T00:00:00.000Z"),
      },
      { skipMakerCheckerValidation: true },
    );

    expect(result).toEqual({
      transferId: TRANSFER_ID,
      ledgerOperationId: opId,
    });
  });

  it("throws approve race error when CAS fails and state is not idempotent", async () => {
    const opId = "550e8400-e29b-41d4-a716-446655440990";
    ledger.commit.mockResolvedValueOnce({
      operationId: opId,
      pendingTransferIdsByRef: new Map<string, bigint>(),
    });

    vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
      const tx = {
        select: vi
          .fn()
          .mockImplementationOnce(() =>
            selectReturning([createTransfer({ status: "draft" })]),
          )
          .mockImplementationOnce(() =>
            selectReturning([{ id: SOURCE_ACCOUNT_ID }]),
          )
          .mockImplementationOnce(() =>
            selectReturning([{ status: "failed", ledgerOperationId: opId }]),
          ),
        execute: vi.fn(async () => ({
          rows: [{ balance_minor: "1000000" }],
        })),
        update: vi.fn(() => updateReturning([])),
      };
      return fn(tx);
    });

    await expect(
      service.approve({
        transferId: TRANSFER_ID,
        checkerUserId: CHECKER_USER_ID,
        occurredAt: new Date("2026-02-25T00:00:00.000Z"),
      }),
    ).rejects.toThrow(InvalidStateError);
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
    expect(ledger.commit).not.toHaveBeenCalled();
  });

  it("rejects approve when source account has insufficient funds", async () => {
    mockSelectReturns(db._tx.select, [
      createTransfer({
        status: "draft",
        amountMinor: 2000n,
      }),
    ]);
    db._tx.execute.mockResolvedValue({
      rows: [{ balance_minor: "1000" }],
    });

    await expect(
      service.approve({
        transferId: TRANSFER_ID,
        checkerUserId: CHECKER_USER_ID,
        occurredAt: new Date("2026-02-25T00:00:00.000Z"),
      }),
    ).rejects.toThrow(InsufficientFundsError);
    expect(ledger.commit).not.toHaveBeenCalled();
  });

  it("checks canApprove before idempotent approve return", async () => {
    const canApprove = vi.fn(async () => false);
    service = createTransfersService({
      db,
      ledger: ledger as any,
      operationalAccountsService: operationalAccountsService as any,
      canApprove,
    });

    mockSelectReturns(db._tx.select, [
      createTransfer({
        status: "posted",
        ledgerOperationId: "550e8400-e29b-41d4-a716-446655440888",
      }),
    ]);

    await expect(
      service.approve({
        transferId: TRANSFER_ID,
        checkerUserId: CHECKER_USER_ID,
        occurredAt: new Date("2026-02-25T00:00:00.000Z"),
      }),
    ).rejects.toThrow(PermissionError);
    expect(canApprove).toHaveBeenCalledWith(
      CHECKER_USER_ID,
      "550e8400-e29b-41d4-a716-446655440111",
      "550e8400-e29b-41d4-a716-446655440222",
    );
  });

  it("returns idempotent reject result when CAS loses race", async () => {
    const draftTransfer = createTransfer({ status: "draft" });

    vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
      const tx = {
        select: vi
          .fn()
          .mockImplementationOnce(() => selectReturning([draftTransfer]))
          .mockImplementationOnce(() =>
            selectReturning([{ status: "rejected" }]),
          ),
        update: vi.fn(() => updateReturning([])),
      };
      return fn(tx);
    });

    const result = await service.reject({
      transferId: TRANSFER_ID,
      checkerUserId: CHECKER_USER_ID,
      occurredAt: new Date("2026-02-25T00:00:00.000Z"),
      reason: "duplicate request",
    });

    expect(result).toBe(TRANSFER_ID);
  });

  it("returns not found when rejecting unknown transfer", async () => {
    mockSelectReturns(db._tx.select, []);

    await expect(
      service.reject({
        transferId: TRANSFER_ID,
        checkerUserId: CHECKER_USER_ID,
        occurredAt: new Date("2026-02-25T00:00:00.000Z"),
        reason: "duplicate request",
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("allows admin override for maker/checker on reject", async () => {
    vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
      const tx = {
        select: vi.fn(() =>
          selectReturning([
            createTransfer({
              status: "draft",
              makerUserId: CHECKER_USER_ID,
            }),
          ]),
        ),
        update: vi.fn(() => updateReturning([{ id: TRANSFER_ID }])),
      };
      return fn(tx);
    });

    const result = await service.reject(
      {
        transferId: TRANSFER_ID,
        checkerUserId: CHECKER_USER_ID,
        occurredAt: new Date("2026-02-25T00:00:00.000Z"),
        reason: "duplicate request",
      },
      { skipMakerCheckerValidation: true },
    );

    expect(result).toBe(TRANSFER_ID);
  });

  it("rejects createDraft when idempotency key is reused with different payload", async () => {
    mockInsertReturns(db.insert, [
      {
        id: TRANSFER_ID,
        sourceOperationalAccountId: SOURCE_ACCOUNT_ID,
        destinationOperationalAccountId: DESTINATION_ACCOUNT_ID,
        currencyId: sourceBinding.currencyId,
        amountMinor: 2000n,
        kind: "cross_org",
        settlementMode: "pending",
        timeoutSeconds: 900,
        memo: "test",
        makerUserId: MAKER_USER_ID,
      },
    ]);

    await expect(
      service.createDraft({
        sourceOperationalAccountId: SOURCE_ACCOUNT_ID,
        destinationOperationalAccountId: DESTINATION_ACCOUNT_ID,
        idempotencyKey: "draft-key",
        amountMinor: 1000n,
        makerUserId: MAKER_USER_ID,
        settlementMode: "pending",
        timeoutSeconds: 900,
        memo: "test",
      }),
    ).rejects.toThrow(InvalidStateError);
  });

  it("returns idempotent settle result on event conflict after state advance", async () => {
    const operationId = "550e8400-e29b-41d4-a716-446655440999";
    ledger.commit.mockResolvedValueOnce({
      operationId,
      pendingTransferIdsByRef: new Map<string, bigint>(),
    });
    const pendingTransfer = createTransfer({
      status: "pending",
      settlementMode: "pending",
      sourcePendingTransferId: 123n,
      destinationPendingTransferId: null,
    });

    vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
      const tx = {
        select: vi
          .fn()
          .mockImplementationOnce(() => selectReturning([pendingTransfer]))
          .mockImplementationOnce(() => selectReturning([]))
          .mockImplementationOnce(() =>
            selectReturning([{ ledgerOperationId: operationId }]),
          )
          .mockImplementationOnce(() =>
            selectReturning([{ status: "posted" }]),
          ),
        insert: vi.fn(() => insertReturning([])),
        update: vi.fn(() => updateReturning([{ id: TRANSFER_ID }])),
      };
      return fn(tx);
    });

    const result = await service.settlePending(
      {
        transferId: TRANSFER_ID,
        eventIdempotencyKey: "settle-event-key",
        occurredAt: new Date("2026-02-25T00:00:00.000Z"),
      },
      CHECKER_USER_ID,
    );

    expect(result).toEqual({
      transferId: TRANSFER_ID,
      ledgerOperationId: operationId,
    });
    expect(ledger.commit).toHaveBeenCalledTimes(1);
  });

  it("returns idempotent settle result from existing matching event", async () => {
    vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
      const tx = {
        select: vi
          .fn()
          .mockImplementationOnce(() =>
            selectReturning([
              createTransfer({
                status: "settle_pending_posting",
                settlementMode: "pending",
                ledgerOperationId: "550e8400-e29b-41d4-a716-446655440996",
              }),
            ]),
          )
          .mockImplementationOnce(() =>
            selectReturning([
              { ledgerOperationId: "550e8400-e29b-41d4-a716-446655440996" },
            ]),
          )
          .mockImplementationOnce(() =>
            selectReturning([{ status: "posted" }]),
          ),
      };
      return fn(tx);
    });

    const result = await service.settlePending(
      {
        transferId: TRANSFER_ID,
        eventIdempotencyKey: "settle-event-key",
        occurredAt: new Date("2026-02-25T00:00:00.000Z"),
      },
      CHECKER_USER_ID,
    );

    expect(result).toEqual({
      transferId: TRANSFER_ID,
      ledgerOperationId: "550e8400-e29b-41d4-a716-446655440996",
    });
    expect(ledger.commit).not.toHaveBeenCalled();
  });

  it("rejects voidPending when transfer is not in pending state", async () => {
    vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
      const tx = {
        select: vi.fn(() =>
          selectReturning([
            createTransfer({
              status: "posted",
              settlementMode: "pending",
              sourcePendingTransferId: 123n,
            }),
          ]),
        ),
      };
      return fn(tx);
    });

    await expect(
      service.voidPending(
        {
          transferId: TRANSFER_ID,
          eventIdempotencyKey: "void-key",
          occurredAt: new Date("2026-02-25T00:00:00.000Z"),
        },
        CHECKER_USER_ID,
      ),
    ).rejects.toThrow(InvalidStateError);
  });

  it("rejects settlePending for immediate settlement transfers", async () => {
    vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
      const tx = {
        select: vi
          .fn()
          .mockImplementationOnce(() =>
            selectReturning([
              createTransfer({
                status: "posted",
                settlementMode: "immediate",
                ledgerOperationId: "550e8400-e29b-41d4-a716-446655440998",
              }),
            ]),
          )
          .mockImplementationOnce(() => selectReturning([])),
      };
      return fn(tx);
    });

    await expect(
      service.settlePending(
        {
          transferId: TRANSFER_ID,
          eventIdempotencyKey: "settle-key-immediate",
          occurredAt: new Date("2026-02-25T00:00:00.000Z"),
        },
        CHECKER_USER_ID,
      ),
    ).rejects.toThrow(InvalidStateError);
  });

  it("rejects completed settle replay when eventIdempotencyKey differs", async () => {
    vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
      const tx = {
        select: vi
          .fn()
          .mockImplementationOnce(() =>
            selectReturning([
              createTransfer({
                status: "posted",
                settlementMode: "pending",
                ledgerOperationId: "550e8400-e29b-41d4-a716-446655440997",
              }),
            ]),
          )
          .mockImplementationOnce(() => selectReturning([])),
      };
      return fn(tx);
    });

    await expect(
      service.settlePending(
        {
          transferId: TRANSFER_ID,
          eventIdempotencyKey: "different-event-key",
          occurredAt: new Date("2026-02-25T00:00:00.000Z"),
        },
        CHECKER_USER_ID,
      ),
    ).rejects.toThrow(InvalidStateError);
  });

  it("returns transfer projection by id", async () => {
    vi.mocked(db.select).mockImplementationOnce(() =>
      selectReturning([
        {
          ...createTransfer(),
          currencyCode: "USD",
          sourceCounterpartyName: "Source",
          destinationCounterpartyName: "Destination",
          sourceOperationalAccountLabel: "Source OA",
          destinationOperationalAccountLabel: "Destination OA",
        },
      ]),
    );

    const transfer = await service.get(TRANSFER_ID);
    expect(transfer.id).toBe(TRANSFER_ID);
    expect(transfer.currencyCode).toBe("USD");
  });

  it("throws not found for missing transfer projection", async () => {
    vi.mocked(db.select).mockImplementationOnce(() => selectReturning([]));

    await expect(service.get(TRANSFER_ID)).rejects.toThrow(NotFoundError);
  });

  it("lists transfers with applied filters and pagination", async () => {
    vi.mocked(db.select)
      .mockImplementationOnce(() =>
        selectListReturning([
          {
            ...createTransfer(),
            currencyCode: "USD",
            sourceCounterpartyName: "Source",
            destinationCounterpartyName: "Destination",
            sourceOperationalAccountLabel: "Source OA",
            destinationOperationalAccountLabel: "Destination OA",
          },
        ]),
      )
      .mockImplementationOnce(() => selectCountReturning([{ total: 1 }]));

    const list = await service.list({
      limit: 10,
      offset: 0,
      sortBy: "updatedAt",
      sortOrder: "asc",
      sourceCounterpartyId: "550e8400-e29b-41d4-a716-446655440111",
      destinationCounterpartyId: "550e8400-e29b-41d4-a716-446655440222",
      status: ["draft"],
      settlementMode: ["pending"],
      kind: ["cross_org"],
    });

    expect(list.total).toBe(1);
    expect(list.data).toHaveLength(1);
  });
});
