import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveTbAccountId } from "../src/resolve";
import { AccountMappingConflictError } from "../src/errors";
import { createMockDb, createMockTbClient } from "./helpers";
import { tbAccountIdFor } from "../src/ids";

function mockDbInsert(tbAccountId: bigint) {
  return {
    values: vi.fn(() => ({
      onConflictDoUpdate: vi.fn(() => ({
        returning: vi.fn(async () => [{ tbAccountId }])
      }))
    }))
  } as any;
}

describe("resolveTbAccountId", () => {
  let db: ReturnType<typeof createMockDb>;
  let tb: ReturnType<typeof createMockTbClient>;

  beforeEach(() => {
    db = createMockDb();
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
    expect(tb.createAccounts).not.toHaveBeenCalled();
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

    // First select: not found
    // Second select: found after insert
    let selectCalls = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCalls++;
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => {
              if (selectCalls === 1) return [];
              return [{ tbAccountId: expectedId }];
            })
          }))
        }))
      } as any;
    });

    vi.mocked(tb.createAccounts).mockResolvedValue([]);
    vi.mocked(db.insert).mockReturnValue(mockDbInsert(expectedId));

    const result = await resolveTbAccountId({ db, tb, orgId, key, currency, tbLedger });

    expect(result).toBe(expectedId);
    expect(tb.createAccounts).toHaveBeenCalled();
    expect(db.insert).toHaveBeenCalled();
  });

  it("should pass correct account to TigerBeetle", async () => {
    const orgId = "org-123";
    const key = "revenue:sales";
    const currency = "USD";
    const tbLedger = 2000;
    const expectedId = tbAccountIdFor(orgId, key, tbLedger);

    let selectCalls = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCalls++;
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => {
              if (selectCalls === 1) return [];
              return [{ tbAccountId: expectedId }];
            })
          }))
        }))
      } as any;
    });

    vi.mocked(tb.createAccounts).mockResolvedValue([]);
    vi.mocked(db.insert).mockReturnValue(mockDbInsert(expectedId));

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

    let selectCalls = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCalls++;
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => {
              if (selectCalls === 1) return [];
              return [{ tbAccountId: expectedId }];
            })
          }))
        }))
      } as any;
    });

    vi.mocked(tb.createAccounts).mockResolvedValue([]);

    const mockValues = vi.fn(() => ({
      onConflictDoUpdate: vi.fn(() => ({
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

    // Simulate race: another process inserts between our insert and re-select
    let selectCalls = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCalls++;
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => {
              if (selectCalls === 1) return []; // Initial: not found
              return [{ tbAccountId: expectedId }]; // Re-select: found
            })
          }))
        }))
      } as any;
    });

    vi.mocked(tb.createAccounts).mockResolvedValue([]);
    vi.mocked(db.insert).mockReturnValue(mockDbInsert(expectedId));

    const result = await resolveTbAccountId({ db, tb, orgId, key, currency, tbLedger });

    expect(result).toBe(expectedId);
  });

  it("should throw if account not found after insert", async () => {
    const orgId = "org-123";
    const key = "customer:dave";
    const currency = "USD";
    const tbLedger = 1000;

    // Always return empty
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [])
        }))
      }))
    } as any);

    vi.mocked(tb.createAccounts).mockResolvedValue([]);
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(() => ({
          returning: vi.fn(async () => []) // Empty return - account not found
        }))
      }))
    } as any);

    await expect(
      resolveTbAccountId({ db, tb, orgId, key, currency, tbLedger })
    ).rejects.toThrow("Failed to persist TB account mapping");
  });

  it("should throw if re-selected account has wrong ID", async () => {
    const orgId = "org-123";
    const key = "customer:eve";
    const currency = "USD";
    const tbLedger = 1000;
    const wrongId = 77777n;

    let selectCalls = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCalls++;
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => {
              if (selectCalls === 1) return [];
              return [{ tbAccountId: wrongId }]; // Wrong ID after insert
            })
          }))
        }))
      } as any;
    });

    vi.mocked(tb.createAccounts).mockResolvedValue([]);
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(() => ({
          returning: vi.fn(async () => [{ tbAccountId: wrongId }]) // Wrong ID returned
        }))
      }))
    } as any);

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
      let selectCalls = 0;
      const expectedId = tbAccountIdFor(orgId, key, tbLedger);

      vi.mocked(db.select).mockImplementation(() => {
        selectCalls++;
        return {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => {
                if (selectCalls === 1) return [];
                return [{ tbAccountId: expectedId }];
              })
            }))
          }))
        } as any;
      });

      vi.mocked(tb.createAccounts).mockResolvedValue([]);
      vi.mocked(db.insert).mockReturnValue(mockDbInsert(expectedId));

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

      let selectCalls = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCalls++;
        return {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => {
                if (selectCalls === 1) return [];
                return [{ tbAccountId: expectedId }];
              })
            }))
          }))
        } as any;
      });

      vi.mocked(tb.createAccounts).mockResolvedValue([]);
      vi.mocked(db.insert).mockReturnValue(mockDbInsert(expectedId));

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

    let selectCalls = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCalls++;
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => {
              if (selectCalls === 1) return [];
              return [{ tbAccountId: expectedId }];
            })
          }))
        }))
      } as any;
    });

    // Import CreateAccountError to use correct error code
    const { CreateAccountError } = await import("tigerbeetle-node");

    // TB account already exists (handled by tbCreateAccountsOrThrow)
    vi.mocked(tb.createAccounts).mockResolvedValue([
      { index: 0, result: CreateAccountError.exists }
    ] as any);

    vi.mocked(db.insert).mockReturnValue(mockDbInsert(expectedId));

    const result = await resolveTbAccountId({ db, tb, orgId, key, currency, tbLedger });
    expect(result).toBe(expectedId);
  });
});
