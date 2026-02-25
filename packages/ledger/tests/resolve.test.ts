import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountMappingConflictError } from "../src/errors";
import { tbBookAccountIdFor, tbLedgerForCurrency } from "../src/ids";
import { resolveTbBookAccountId } from "../src/resolve";
import { createMockTbClient, createStubDb, type StubDatabase } from "./helpers";

describe("resolveTbBookAccountId", () => {
  let db: StubDatabase;
  let tb: ReturnType<typeof createMockTbClient>;

  beforeEach(() => {
    db = createStubDb();
    tb = createMockTbClient();
  });

  it("returns existing mapped account ID", async () => {
    const orgId = "550e8400-e29b-41d4-a716-446655440000";
    const accountNo = "1000";
    const currency = "USD";
    const tbLedger = tbLedgerForCurrency(currency);
    const expectedId = tbBookAccountIdFor(orgId, accountNo, currency, tbLedger);

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [{ tbAccountId: expectedId }]),
        })),
      })),
    } as any);

    const result = await resolveTbBookAccountId({
      db,
      tb,
      orgId,
      accountNo,
      currency,
    });

    expect(result).toBe(expectedId);
    expect(db.insert).not.toHaveBeenCalled();
    expect(tb.createAccounts).toHaveBeenCalledWith([
      expect.objectContaining({ id: expectedId, ledger: tbLedger }),
    ]);
  });

  it("throws when existing mapping has a different TB account ID", async () => {
    const orgId = "550e8400-e29b-41d4-a716-446655440000";
    const accountNo = "1000";
    const currency = "USD";

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [{ tbAccountId: 99999n }]),
        })),
      })),
    } as any);

    await expect(
      resolveTbBookAccountId({ db, tb, orgId, accountNo, currency }),
    ).rejects.toThrow(AccountMappingConflictError);

    expect(tb.createAccounts).not.toHaveBeenCalled();
  });

  it("inserts mapping when absent and returns deterministic ID", async () => {
    const orgId = "550e8400-e29b-41d4-a716-446655440000";
    const accountNo = "2000";
    const currency = "USD";
    const tbLedger = tbLedgerForCurrency(currency);
    const expectedId = tbBookAccountIdFor(orgId, accountNo, currency, tbLedger);

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => []),
        })),
      })),
    } as any);

    const insertValues = vi.fn(() => ({
      onConflictDoNothing: vi.fn(async () => undefined),
    }));
    vi.mocked(db.insert).mockReturnValue({ values: insertValues } as any);

    const result = await resolveTbBookAccountId({
      db,
      tb,
      orgId,
      accountNo,
      currency,
    });

    expect(result).toBe(expectedId);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId,
        accountNo,
        currency,
        tbLedger,
        tbAccountId: expectedId,
      }),
    );
  });

  it("passes a bounded account code to TigerBeetle", async () => {
    const orgId = "550e8400-e29b-41d4-a716-446655440000";
    const accountNo = "3000";
    const currency = "USD";

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => []),
        })),
      })),
    } as any);
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn(() => ({ onConflictDoNothing: vi.fn(async () => undefined) })),
    } as any);

    await resolveTbBookAccountId({
      db,
      tb,
      orgId,
      accountNo,
      currency,
    });

    const created = vi.mocked(tb.createAccounts).mock.calls[0]![0]![0];
    expect(created.code).toBeGreaterThan(0);
    expect(created.code).toBeLessThanOrEqual(0xffff);
  });

  it("treats TigerBeetle account exists as success", async () => {
    const { CreateAccountError } = await import("tigerbeetle-node");

    const orgId = "550e8400-e29b-41d4-a716-446655440000";
    const accountNo = "4000";
    const currency = "USD";

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => []),
        })),
      })),
    } as any);
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn(() => ({ onConflictDoNothing: vi.fn(async () => undefined) })),
    } as any);

    vi.mocked(tb.createAccounts).mockResolvedValue([
      { index: 0, result: CreateAccountError.exists },
    ] as any);

    await expect(
      resolveTbBookAccountId({ db, tb, orgId, accountNo, currency }),
    ).resolves.toBeTypeOf("bigint");
  });

  it("throws when TigerBeetle account creation fails", async () => {
    const { CreateAccountError } = await import("tigerbeetle-node");

    const orgId = "550e8400-e29b-41d4-a716-446655440000";
    const accountNo = "5000";
    const currency = "USD";

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => []),
        })),
      })),
    } as any);
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn(() => ({ onConflictDoNothing: vi.fn(async () => undefined) })),
    } as any);

    vi.mocked(tb.createAccounts).mockResolvedValue([
      { index: 0, result: CreateAccountError.linked_event_failed },
    ] as any);

    await expect(
      resolveTbBookAccountId({ db, tb, orgId, accountNo, currency }),
    ).rejects.toThrow("TigerBeetle createAccounts failed");
  });

  it("derives different IDs for different currencies", async () => {
    const orgId = "550e8400-e29b-41d4-a716-446655440000";
    const accountNo = "1000";

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => []),
        })),
      })),
    } as any);
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn(() => ({ onConflictDoNothing: vi.fn(async () => undefined) })),
    } as any);

    const usd = await resolveTbBookAccountId({
      db,
      tb,
      orgId,
      accountNo,
      currency: "USD",
    });

    const eur = await resolveTbBookAccountId({
      db,
      tb,
      orgId,
      accountNo,
      currency: "EUR",
    });

    expect(usd).not.toBe(eur);
  });
});
