import { beforeEach, describe, expect, it, vi } from "vitest";

import { sha256Hex, stableStringify } from "@bedrock/kernel";

import { AccountMappingConflictError } from "../src/errors";
import { tbBookAccountInstanceIdFor, tbLedgerForCurrency } from "../src/ids";
import { resolveTbBookAccountInstanceId } from "../src/resolve";
import { createMockTbClient, createStubDb, type StubDatabase } from "./helpers";

describe("resolveTbBookAccountInstanceId", () => {
  let db: StubDatabase;
  let tb: ReturnType<typeof createMockTbClient>;

  beforeEach(() => {
    db = createStubDb();
    tb = createMockTbClient();
  });

  const emptyDimensionsHash = sha256Hex(stableStringify({}));

  it("returns existing mapped account ID", async () => {
    const orgId = "550e8400-e29b-41d4-a716-446655440000";
    const accountNo = "1000";
    const currency = "USD";
    const tbLedger = tbLedgerForCurrency(currency);
    const expectedId = tbBookAccountInstanceIdFor(
      orgId,
      accountNo,
      currency,
      emptyDimensionsHash,
      tbLedger,
    );

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [{ tbAccountId: expectedId }]),
        })),
      })),
    } as any);

    const result = await resolveTbBookAccountInstanceId({
      db,
      tb,
      bookOrgId: orgId,
      accountNo,
      currency,
      dimensions: {},
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
      resolveTbBookAccountInstanceId({
        db,
        tb,
        bookOrgId: orgId,
        accountNo,
        currency,
        dimensions: {},
      }),
    ).rejects.toThrow(AccountMappingConflictError);

    expect(tb.createAccounts).not.toHaveBeenCalled();
  });

  it("inserts mapping when absent and returns deterministic ID", async () => {
    const orgId = "550e8400-e29b-41d4-a716-446655440000";
    const accountNo = "2000";
    const currency = "USD";
    const tbLedger = tbLedgerForCurrency(currency);
    const expectedId = tbBookAccountInstanceIdFor(
      orgId,
      accountNo,
      currency,
      emptyDimensionsHash,
      tbLedger,
    );

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

    const result = await resolveTbBookAccountInstanceId({
      db,
      tb,
      bookOrgId: orgId,
      accountNo,
      currency,
      dimensions: {},
    });

    expect(result).toBe(expectedId);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        bookOrgId: orgId,
        accountNo,
        currency,
        dimensionsHash: expect.any(String),
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

    await resolveTbBookAccountInstanceId({
      db,
      tb,
      bookOrgId: orgId,
      accountNo,
      currency,
      dimensions: {},
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
      resolveTbBookAccountInstanceId({
        db,
        tb,
        bookOrgId: orgId,
        accountNo,
        currency,
        dimensions: {},
      }),
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
      resolveTbBookAccountInstanceId({
        db,
        tb,
        bookOrgId: orgId,
        accountNo,
        currency,
        dimensions: {},
      }),
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

    const usd = await resolveTbBookAccountInstanceId({
      db,
      tb,
      bookOrgId: orgId,
      accountNo,
      currency: "USD",
      dimensions: {},
    });

    const eur = await resolveTbBookAccountInstanceId({
      db,
      tb,
      bookOrgId: orgId,
      accountNo,
      currency: "EUR",
      dimensions: {},
    });

    expect(usd).not.toBe(eur);
  });
});
