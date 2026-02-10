import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveTbAccountId } from "../src/resolve";
import { AccountMappingConflictError } from "../src/errors";
import { createStubDb, createMockTbClient, type StubDatabase } from "./helpers";
import { tbAccountIdFor } from "../src/ids";

/**
 * Create insert chain mock for successful insert
 */
function mockDbInsertSuccess(tbAccountId: bigint) {
  return {
    values: vi.fn(() => ({
      onConflictDoNothing: vi.fn(() => ({
        returning: vi.fn(async () => [{ tbAccountId }]),
      })),
    })),
  } as any;
}

/**
 * Create insert chain mock for conflict (empty returning)
 */
function mockDbInsertConflict() {
  return {
    values: vi.fn(() => ({
      onConflictDoNothing: vi.fn(() => ({
        returning: vi.fn(async () => []),
      })),
    })),
  } as any;
}

describe("resolveTbAccountId", () => {
  let db: StubDatabase;
  let tb: ReturnType<typeof createMockTbClient>;

  beforeEach(() => {
    db = createStubDb();
    tb = createMockTbClient();
  });

  it("should return existing account ID from database", async () => {
    const orgId = "org-123";
    const key = "customer:alice";
    const currency = "USD";
    const tbLedger = 1000;
    const expectedId = tbAccountIdFor(orgId, key, tbLedger);

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [{ tbAccountId: expectedId }])
        }))
      }))
    } as any);

    const result = await resolveTbAccountId({ db, tb, orgId, key, currency, tbLedger });

    expect(result).toBe(expectedId);
    expect(tb.createAccounts).toHaveBeenCalledWith([
      expect.objectContaining({
        id: expectedId,
        ledger: tbLedger,
      }),
    ]);
  });

  it("should throw if existing account has wrong ID", async () => {
    const orgId = "org-123";
    const key = "customer:alice";
    const currency = "USD";
    const tbLedger = 1000;
    const wrongId = 99999n;

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [{ tbAccountId: wrongId }])
        }))
      }))
    } as any);

    await expect(
      resolveTbAccountId({ db, tb, orgId, key, currency, tbLedger })
    ).rejects.toThrow(AccountMappingConflictError);
  });

  it("should create new account if not exists", async () => {
    const orgId = "org-123";
    const key = "customer:bob";
    const currency = "USD";
    const tbLedger = 1000;
    const expectedId = tbAccountIdFor(orgId, key, tbLedger);

    // First select: not found (triggers insert flow)
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [])
        }))
      }))
    } as any);

    vi.mocked(tb.createAccounts).mockResolvedValue([]);
    // DB insert succeeds (returns inserted row)
    vi.mocked(db.insert).mockReturnValue(mockDbInsertSuccess(expectedId));

    const result = await resolveTbAccountId({ db, tb, orgId, key, currency, tbLedger });

    expect(result).toBe(expectedId);
    expect(db.insert).toHaveBeenCalled();
    expect(tb.createAccounts).toHaveBeenCalled();
  });

  it("should pass correct account to TigerBeetle", async () => {
    const orgId = "org-123";
    const key = "revenue:sales";
    const currency = "USD";
    const tbLedger = 2000;
    const expectedId = tbAccountIdFor(orgId, key, tbLedger);

    // First select: not found
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [])
        }))
      }))
    } as any);

    vi.mocked(tb.createAccounts).mockResolvedValue([]);
    vi.mocked(db.insert).mockReturnValue(mockDbInsertSuccess(expectedId));

    await resolveTbAccountId({ db, tb, orgId, key, currency, tbLedger });

    expect(tb.createAccounts).toHaveBeenCalledWith([
      expect.objectContaining({
        id: expectedId,
        ledger: tbLedger
      })
    ]);
  });

  it("should insert correct values into database", async () => {
    const orgId = "org-123";
    const key = "expense:payroll";
    const currency = "USD";
    const tbLedger = 3000;
    const expectedId = tbAccountIdFor(orgId, key, tbLedger);

    // First select: not found
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [])
        }))
      }))
    } as any);

    vi.mocked(tb.createAccounts).mockResolvedValue([]);

    const mockValues = vi.fn(() => ({
      onConflictDoNothing: vi.fn(() => ({
        returning: vi.fn(async () => [{ tbAccountId: expectedId }])
      }))
    }));
    vi.mocked(db.insert).mockReturnValue({ values: mockValues } as any);

    await resolveTbAccountId({ db, tb, orgId, key, currency, tbLedger });

    expect(mockValues).toHaveBeenCalledWith({
      orgId,
      key,
      currency,
      tbLedger,
      tbAccountId: expectedId
    });
  });

  it("should handle race condition with onConflictDoNothing", async () => {
    const orgId = "org-123";
    const key = "customer:charlie";
    const currency = "USD";
    const tbLedger = 1000;
    const expectedId = tbAccountIdFor(orgId, key, tbLedger);

    // Simulate race: another process wins the insert
    // First select: not found, then after conflict: found via re-fetch
    let selectCalls = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCalls++;
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => {
              if (selectCalls === 1) return []; // Initial: not found
              return [{ tbAccountId: expectedId }]; // Re-fetch after conflict: found
            })
          }))
        }))
      } as any;
    });

    // Insert returns empty (conflict - another process won)
    vi.mocked(db.insert).mockReturnValue(mockDbInsertConflict());

    const result = await resolveTbAccountId({ db, tb, orgId, key, currency, tbLedger });

    expect(result).toBe(expectedId);
    // TigerBeetle should NOT be called when we lose the race
    expect(tb.createAccounts).not.toHaveBeenCalled();
  });

  it("should throw if account not found after insert conflict", async () => {
    const orgId = "org-123";
    const key = "customer:dave";
    const currency = "USD";
    const tbLedger = 1000;

    // Always return empty (even on re-fetch after conflict)
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [])
        }))
      }))
    } as any);

    // Insert returns empty (conflict)
    vi.mocked(db.insert).mockReturnValue(mockDbInsertConflict());

    await expect(
      resolveTbAccountId({ db, tb, orgId, key, currency, tbLedger })
    ).rejects.toThrow("Account mapping conflict but row not found");
  });

  it("should throw if re-fetched account has wrong ID after conflict", async () => {
    const orgId = "org-123";
    const key = "customer:eve";
    const currency = "USD";
    const tbLedger = 1000;
    const wrongId = 77777n;

    // First select: not found, then re-fetch returns wrong ID
    let selectCalls = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCalls++;
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => {
              if (selectCalls === 1) return [];
              return [{ tbAccountId: wrongId }]; // Wrong ID on re-fetch
            })
          }))
        }))
      } as any;
    });

    // Insert returns empty (conflict)
    vi.mocked(db.insert).mockReturnValue(mockDbInsertConflict());

    await expect(
      resolveTbAccountId({ db, tb, orgId, key, currency, tbLedger })
    ).rejects.toThrow(AccountMappingConflictError);
  });

  it("should generate deterministic account codes", async () => {
    const orgId = "org-123";
    const keys = ["customer:a", "customer:b", "revenue:sales"];
    const currency = "USD";
    const tbLedger = 1000;

    for (const key of keys) {
      const expectedId = tbAccountIdFor(orgId, key, tbLedger);

      // First select: not found
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [])
          }))
        }))
      } as any);

      vi.mocked(tb.createAccounts).mockResolvedValue([]);
      vi.mocked(db.insert).mockReturnValue(mockDbInsertSuccess(expectedId));

      await resolveTbAccountId({ db, tb, orgId, key, currency, tbLedger });

      const call = vi.mocked(tb.createAccounts).mock.calls[0];
      expect(call).toBeDefined();
      const account = call![0]![0];
      expect(account.code).toBeGreaterThan(0);
      expect(account.code).toBeLessThanOrEqual(0xFFFF);
    }
  });

  it("should handle different currencies for same key", async () => {
    const orgId = "org-123";
    const key = "customer:alice";
    const currencies = ["USD", "EUR", "GBP"];

    for (const currency of currencies) {
      const tbLedger = 1000 + currencies.indexOf(currency);
      const expectedId = tbAccountIdFor(orgId, key, tbLedger);

      // First select: not found
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [])
          }))
        }))
      } as any);

      vi.mocked(tb.createAccounts).mockResolvedValue([]);
      vi.mocked(db.insert).mockReturnValue(mockDbInsertSuccess(expectedId));

      const result = await resolveTbAccountId({ db, tb, orgId, key, currency, tbLedger });
      expect(result).toBe(expectedId);
    }
  });

  it("should handle TigerBeetle account already exists", async () => {
    const orgId = "org-123";
    const key = "customer:existing";
    const currency = "USD";
    const tbLedger = 1000;
    const expectedId = tbAccountIdFor(orgId, key, tbLedger);

    // First select: not found
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [])
        }))
      }))
    } as any);

    // Import CreateAccountError to use correct error code
    const { CreateAccountError } = await import("tigerbeetle-node");

    // TB account already exists (handled by tbCreateAccountsOrThrow - exists is treated as success)
    vi.mocked(tb.createAccounts).mockResolvedValue([
      { index: 0, result: CreateAccountError.exists }
    ] as any);

    vi.mocked(db.insert).mockReturnValue(mockDbInsertSuccess(expectedId));

    const result = await resolveTbAccountId({ db, tb, orgId, key, currency, tbLedger });
    expect(result).toBe(expectedId);
  });

  it("should fail when existing DB mapping cannot be created in TigerBeetle", async () => {
    const orgId = "org-123";
    const key = "customer:broken";
    const currency = "USD";
    const tbLedger = 1000;
    const expectedId = tbAccountIdFor(orgId, key, tbLedger);

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [{ tbAccountId: expectedId }])
        }))
      }))
    } as any);

    const { CreateAccountError } = await import("tigerbeetle-node");
    vi.mocked(tb.createAccounts).mockResolvedValue([
      { index: 0, result: CreateAccountError.linked_event_failed }
    ] as any);

    await expect(
      resolveTbAccountId({ db, tb, orgId, key, currency, tbLedger })
    ).rejects.toThrow("TigerBeetle createAccounts failed");
  });
});
