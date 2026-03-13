import { describe, it, expect, vi } from "vitest";

import { createMockTbClient } from "./helpers";
import { TigerBeetleBatchError } from "../src/errors";
import {
  makeTbAccount,
  makeTbTransfer,
  tbCreateAccountsOrThrow,
  tbCreateTransfersOrThrow,
  TB_AMOUNT_MAX,
  TransferFlags,
  CreateAccountError,
  CreateTransferError
} from "@bedrock/adapter-ledger-tigerbeetle";

describe("TB_AMOUNT_MAX", () => {
  it("should be 2^128 - 1", () => {
    const expected = (1n << 128n) - 1n;
    expect(TB_AMOUNT_MAX).toBe(expected);
  });

  it("should be maximum uint128 value", () => {
    expect(TB_AMOUNT_MAX).toBeGreaterThan(0n);
    expect(TB_AMOUNT_MAX.toString()).toHaveLength(39); // ~39 decimal digits
  });
});

describe("makeTbAccount", () => {
  it("should create account with required fields", () => {
    const account = makeTbAccount(12345n, 1000, 1);

    expect(account.id).toBe(12345n);
    expect(account.ledger).toBe(1000);
    expect(account.code).toBe(1);
    expect(account.flags).toBe(0);
  });

  it("should initialize balance fields to zero", () => {
    const account = makeTbAccount(1n, 1, 1);

    expect(account.debits_pending).toBe(0n);
    expect(account.debits_posted).toBe(0n);
    expect(account.credits_pending).toBe(0n);
    expect(account.credits_posted).toBe(0n);
  });

  it("should initialize user data fields", () => {
    const account = makeTbAccount(1n, 1, 1);

    expect(account.user_data_128).toBe(0n);
    expect(account.user_data_64).toBe(0n);
    expect(account.user_data_32).toBe(0);
  });

  it("should initialize reserved and timestamp", () => {
    const account = makeTbAccount(1n, 1, 1);

    expect(account.reserved).toBe(0);
    expect(account.timestamp).toBe(0n);
  });

  it("should handle large account IDs", () => {
    const largeId = (1n << 127n) - 1n;
    const account = makeTbAccount(largeId, 1000, 1);

    expect(account.id).toBe(largeId);
  });

  it("should handle different codes", () => {
    const codes = [1, 100, 999, 12345];

    for (const code of codes) {
      const account = makeTbAccount(1n, 1000, code);
      expect(account.code).toBe(code);
    }
  });
});

describe("makeTbTransfer", () => {
  it("should create transfer with required fields", () => {
    const transfer = makeTbTransfer({
      id: 12345n,
      debitAccountId: 100n,
      creditAccountId: 200n,
      amount: 50000n,
      tbLedger: 1000,
      code: 1
    });

    expect(transfer.id).toBe(12345n);
    expect(transfer.debit_account_id).toBe(100n);
    expect(transfer.credit_account_id).toBe(200n);
    expect(transfer.amount).toBe(50000n);
    expect(transfer.ledger).toBe(1000);
    expect(transfer.code).toBe(1);
  });

  it("should default pending_id to 0", () => {
    const transfer = makeTbTransfer({
      id: 1n,
      debitAccountId: 10n,
      creditAccountId: 20n,
      amount: 100n,
      tbLedger: 1,
      code: 1
    });

    expect(transfer.pending_id).toBe(0n);
  });

  it("should default flags to 0", () => {
    const transfer = makeTbTransfer({
      id: 1n,
      debitAccountId: 10n,
      creditAccountId: 20n,
      amount: 100n,
      tbLedger: 1,
      code: 1
    });

    expect(transfer.flags).toBe(0);
  });

  it("should default timeout to 0", () => {
    const transfer = makeTbTransfer({
      id: 1n,
      debitAccountId: 10n,
      creditAccountId: 20n,
      amount: 100n,
      tbLedger: 1,
      code: 1
    });

    expect(transfer.timeout).toBe(0);
  });

  it("should accept optional pendingId", () => {
    const transfer = makeTbTransfer({
      id: 1n,
      debitAccountId: 10n,
      creditAccountId: 20n,
      amount: 100n,
      tbLedger: 1,
      code: 1,
      pendingId: 99999n
    });

    expect(transfer.pending_id).toBe(99999n);
  });

  it("should accept optional flags", () => {
    const flags = TransferFlags.linked | TransferFlags.pending;
    const transfer = makeTbTransfer({
      id: 1n,
      debitAccountId: 10n,
      creditAccountId: 20n,
      amount: 100n,
      tbLedger: 1,
      code: 1,
      flags
    });

    expect(transfer.flags).toBe(flags);
  });

  it("should accept optional timeoutSeconds", () => {
    const transfer = makeTbTransfer({
      id: 1n,
      debitAccountId: 10n,
      creditAccountId: 20n,
      amount: 100n,
      tbLedger: 1,
      code: 1,
      timeoutSeconds: 3600
    });

    expect(transfer.timeout).toBe(3600);
  });

  it("should initialize user data fields", () => {
    const transfer = makeTbTransfer({
      id: 1n,
      debitAccountId: 10n,
      creditAccountId: 20n,
      amount: 100n,
      tbLedger: 1,
      code: 1
    });

    expect(transfer.user_data_128).toBe(0n);
    expect(transfer.user_data_64).toBe(0n);
    expect(transfer.user_data_32).toBe(0);
  });

  it("should initialize timestamp to 0", () => {
    const transfer = makeTbTransfer({
      id: 1n,
      debitAccountId: 10n,
      creditAccountId: 20n,
      amount: 100n,
      tbLedger: 1,
      code: 1
    });

    expect(transfer.timestamp).toBe(0n);
  });

  it("should handle large amounts", () => {
    const largeAmount = 99999999999999n;
    const transfer = makeTbTransfer({
      id: 1n,
      debitAccountId: 10n,
      creditAccountId: 20n,
      amount: largeAmount,
      tbLedger: 1,
      code: 1
    });

    expect(transfer.amount).toBe(largeAmount);
  });

  it("should create pending transfer with timeout", () => {
    const transfer = makeTbTransfer({
      id: 1n,
      debitAccountId: 10n,
      creditAccountId: 20n,
      amount: 100n,
      tbLedger: 1,
      code: 1,
      flags: TransferFlags.pending,
      timeoutSeconds: 7200
    });

    expect(transfer.flags & TransferFlags.pending).toBeGreaterThan(0);
    expect(transfer.timeout).toBe(7200);
  });

  it("should create linked transfer", () => {
    const transfer = makeTbTransfer({
      id: 1n,
      debitAccountId: 10n,
      creditAccountId: 20n,
      amount: 100n,
      tbLedger: 1,
      code: 1,
      flags: TransferFlags.linked
    });

    expect(transfer.flags & TransferFlags.linked).toBeGreaterThan(0);
  });
});

describe("tbCreateAccountsOrThrow", () => {
  it("should succeed when no errors", async () => {
    const tb = createMockTbClient();
    vi.mocked(tb.createAccounts).mockResolvedValue([]);

    const accounts = [makeTbAccount(1n, 1000, 1)];
    await expect(tbCreateAccountsOrThrow(tb, accounts)).resolves.toBeUndefined();
    expect(tb.createAccounts).toHaveBeenCalledWith(accounts);
  });

  it("should succeed when only exists errors", async () => {
    const tb = createMockTbClient();
    vi.mocked(tb.createAccounts).mockResolvedValue([
      { index: 0, result: CreateAccountError.exists }
    ] as any);

    const accounts = [makeTbAccount(1n, 1000, 1)];
    await expect(tbCreateAccountsOrThrow(tb, accounts)).resolves.toBeUndefined();
  });

  it("should throw on hard errors", async () => {
    const tb = createMockTbClient();
    vi.mocked(tb.createAccounts).mockResolvedValue([
      { index: 0, result: 10 } // Some error code != exists
    ] as any);

    const accounts = [makeTbAccount(1n, 1000, 1)];

    await expect(tbCreateAccountsOrThrow(tb, accounts))
      .rejects
      .toThrow(TigerBeetleBatchError);
  });

  it("should throw with correct operation name", async () => {
    const tb = createMockTbClient();
    vi.mocked(tb.createAccounts).mockResolvedValue([
      { index: 0, result: 5 }
    ] as any);

    const accounts = [makeTbAccount(1n, 1000, 1)];

    try {
      await tbCreateAccountsOrThrow(tb, accounts);
      expect.fail("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(TigerBeetleBatchError);
      const err = e as TigerBeetleBatchError;
      expect(err.operation).toBe("createAccounts");
    }
  });

  it("should include error details", async () => {
    const tb = createMockTbClient();
    vi.mocked(tb.createAccounts).mockResolvedValue([
      { index: 0, result: 5 },
      { index: 2, result: 10 }
    ] as any);

    const accounts = [
      makeTbAccount(1n, 1000, 1),
      makeTbAccount(2n, 1000, 1),
      makeTbAccount(3n, 1000, 1)
    ];

    try {
      await tbCreateAccountsOrThrow(tb, accounts);
      expect.fail("Should have thrown");
    } catch (e) {
      const err = e as TigerBeetleBatchError;
      expect(err.details).toHaveLength(2);
      expect(err.details[0]?.index).toBe(0);
      expect(err.details[1]?.index).toBe(2);
    }
  });

  it("should filter out exists errors from details", async () => {
    const tb = createMockTbClient();
    vi.mocked(tb.createAccounts).mockResolvedValue([
      { index: 0, result: CreateAccountError.exists },
      { index: 1, result: 10 }, // Hard error
      { index: 2, result: CreateAccountError.exists }
    ] as any);

    const accounts = [
      makeTbAccount(1n, 1000, 1),
      makeTbAccount(2n, 1000, 1),
      makeTbAccount(3n, 1000, 1)
    ];

    try {
      await tbCreateAccountsOrThrow(tb, accounts);
      expect.fail("Should have thrown");
    } catch (e) {
      const err = e as TigerBeetleBatchError;
      expect(err.details).toHaveLength(1);
      expect(err.details[0]?.index).toBe(1);
    }
  });
});

describe("tbCreateTransfersOrThrow", () => {
  it("should succeed when no errors", async () => {
    const tb = createMockTbClient();
    vi.mocked(tb.createTransfers).mockResolvedValue([]);

    const transfers = [
      makeTbTransfer({
        id: 1n,
        debitAccountId: 10n,
        creditAccountId: 20n,
        amount: 100n,
        tbLedger: 1000,
        code: 1
      })
    ];

    await expect(tbCreateTransfersOrThrow(tb, transfers)).resolves.toBeUndefined();
    expect(tb.createTransfers).toHaveBeenCalledWith(transfers);
  });

  it("should succeed when only exists errors", async () => {
    const tb = createMockTbClient();
    vi.mocked(tb.createTransfers).mockResolvedValue([
      { index: 0, result: CreateTransferError.exists }
    ] as any);

    const transfers = [
      makeTbTransfer({
        id: 1n,
        debitAccountId: 10n,
        creditAccountId: 20n,
        amount: 100n,
        tbLedger: 1000,
        code: 1
      })
    ];

    await expect(tbCreateTransfersOrThrow(tb, transfers)).resolves.toBeUndefined();
  });

  it("should throw on hard errors", async () => {
    const tb = createMockTbClient();
    vi.mocked(tb.createTransfers).mockResolvedValue([
      { index: 0, result: 20 } // Some error code != exists
    ] as any);

    const transfers = [
      makeTbTransfer({
        id: 1n,
        debitAccountId: 10n,
        creditAccountId: 20n,
        amount: 100n,
        tbLedger: 1000,
        code: 1
      })
    ];

    await expect(tbCreateTransfersOrThrow(tb, transfers))
      .rejects
      .toThrow(TigerBeetleBatchError);
  });

  it("should throw with correct operation name", async () => {
    const tb = createMockTbClient();
    vi.mocked(tb.createTransfers).mockResolvedValue([
      { index: 0, result: 5 }
    ] as any);

    const transfers = [
      makeTbTransfer({
        id: 1n,
        debitAccountId: 10n,
        creditAccountId: 20n,
        amount: 100n,
        tbLedger: 1000,
        code: 1
      })
    ];

    try {
      await tbCreateTransfersOrThrow(tb, transfers);
      expect.fail("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(TigerBeetleBatchError);
      const err = e as TigerBeetleBatchError;
      expect(err.operation).toBe("createTransfers");
    }
  });

  it("should include error details", async () => {
    const tb = createMockTbClient();
    vi.mocked(tb.createTransfers).mockResolvedValue([
      { index: 1, result: 15 },
      { index: 3, result: 25 }
    ] as any);

    const transfers = Array.from({ length: 5 }, (_, i) =>
      makeTbTransfer({
        id: BigInt(i + 1),
        debitAccountId: 10n,
        creditAccountId: 20n,
        amount: 100n,
        tbLedger: 1000,
        code: 1
      })
    );

    try {
      await tbCreateTransfersOrThrow(tb, transfers);
      expect.fail("Should have thrown");
    } catch (e) {
      const err = e as TigerBeetleBatchError;
      expect(err.details).toHaveLength(2);
      expect(err.details[0]?.index).toBe(1);
      expect(err.details[1]?.index).toBe(3);
    }
  });

  it("should filter out exists errors from details", async () => {
    const tb = createMockTbClient();
    vi.mocked(tb.createTransfers).mockResolvedValue([
      { index: 0, result: CreateTransferError.exists },
      { index: 1, result: 20 }, // Hard error
      { index: 2, result: CreateTransferError.exists }
    ] as any);

    const transfers = Array.from({ length: 3 }, (_, i) =>
      makeTbTransfer({
        id: BigInt(i + 1),
        debitAccountId: 10n,
        creditAccountId: 20n,
        amount: 100n,
        tbLedger: 1000,
        code: 1
      })
    );

    try {
      await tbCreateTransfersOrThrow(tb, transfers);
      expect.fail("Should have thrown");
    } catch (e) {
      const err = e as TigerBeetleBatchError;
      expect(err.details).toHaveLength(1);
      expect(err.details[0]?.index).toBe(1);
    }
  });
});
