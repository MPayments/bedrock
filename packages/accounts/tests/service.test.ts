import { describe, expect, it, vi } from "vitest";

import { createAccountService } from "../src/service";
import {
  AccountNotFoundError,
  AccountProviderNotFoundError,
  AccountProviderInUseError,
  ValidationError,
} from "../src/errors";

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeProvider(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000301",
    type: "bank",
    name: "Sberbank",
    description: null,
    country: "RU",
    address: null,
    contact: null,
    bic: "044525225",
    swift: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000401",
    counterpartyId: "00000000-0000-4000-8000-000000000501",
    currencyId: "00000000-0000-4000-8000-000000000601",
    accountProviderId: "00000000-0000-4000-8000-000000000301",
    label: "Основной счёт",
    description: null,
    accountNo: "40817810099910004312",
    corrAccount: "30101810400000000225",
    address: null,
    iban: null,
    stableKey: "main-rub",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Chain builders for Drizzle query mocking
// ---------------------------------------------------------------------------

function selectSingleRow<T>(rows: T[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(async () => rows),
      })),
    })),
  };
}

function selectWhereTerminal<T>(rows: T[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(async () => rows),
    })),
  };
}

function selectList<T>(rows: T[]) {
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

function insertReturning<T>(rows: T[]) {
  return {
    values: vi.fn(() => ({
      returning: vi.fn(async () => rows),
    })),
  };
}

function updateReturning<T>(rows: T[]) {
  return {
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(async () => rows),
      })),
    })),
  };
}

function deleteReturning<T>(rows: T[]) {
  return {
    where: vi.fn(() => ({
      returning: vi.fn(async () => rows),
    })),
  };
}

function createStubDb() {
  return {
    transaction: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

describe("providers", () => {
  it("creates a provider", async () => {
    const provider = makeProvider();
    const db = createStubDb();
    db.insert.mockReturnValue(insertReturning([provider]));

    const service = createAccountService({ db: db as any });
    const result = await service.createProvider({
      type: "bank",
      name: "Sberbank",
      country: "RU",
      bic: "044525225",
    });

    expect(result).toEqual(provider);
    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  it("gets a provider by ID", async () => {
    const provider = makeProvider();
    const db = createStubDb();
    db.select.mockReturnValue(selectSingleRow([provider]));

    const service = createAccountService({ db: db as any });
    const result = await service.getProvider(provider.id);

    expect(result).toEqual(provider);
  });

  it("throws AccountProviderNotFoundError for missing provider", async () => {
    const db = createStubDb();
    db.select.mockReturnValue(selectSingleRow([]));

    const service = createAccountService({ db: db as any });

    await expect(service.getProvider("missing-id")).rejects.toThrow(
      AccountProviderNotFoundError,
    );
  });

  it("updates a provider name", async () => {
    const existing = makeProvider();
    const updated = makeProvider({ name: "Sber" });
    const db = createStubDb();
    const tx = {
      select: vi.fn().mockReturnValueOnce(selectSingleRow([existing])),
      update: vi.fn().mockReturnValueOnce(updateReturning([updated])),
      insert: vi.fn(),
      delete: vi.fn(),
    };
    db.transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => fn(tx),
    );

    const service = createAccountService({ db: db as any });
    const result = await service.updateProvider(existing.id, { name: "Sber" });

    expect(result).toEqual(updated);
    expect(tx.update).toHaveBeenCalledTimes(1);
  });

  it("returns existing when update has no fields", async () => {
    const existing = makeProvider();
    const db = createStubDb();
    const tx = {
      select: vi.fn().mockReturnValueOnce(selectSingleRow([existing])),
      update: vi.fn(),
      insert: vi.fn(),
      delete: vi.fn(),
    };
    db.transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => fn(tx),
    );

    const service = createAccountService({ db: db as any });
    const result = await service.updateProvider(existing.id, {});

    expect(result).toEqual(existing);
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("throws AccountProviderNotFoundError when updating missing provider", async () => {
    const db = createStubDb();
    const tx = {
      select: vi.fn().mockReturnValueOnce(selectSingleRow([])),
      update: vi.fn(),
      insert: vi.fn(),
      delete: vi.fn(),
    };
    db.transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => fn(tx),
    );

    const service = createAccountService({ db: db as any });

    await expect(
      service.updateProvider("missing-id", { name: "Nope" }),
    ).rejects.toThrow(AccountProviderNotFoundError);
  });

  it("rejects update that violates BIC/SWIFT rules", async () => {
    const existing = makeProvider({ country: "RU", bic: "044525225" });
    const db = createStubDb();
    const tx = {
      select: vi.fn().mockReturnValueOnce(selectSingleRow([existing])),
      update: vi.fn(),
      insert: vi.fn(),
      delete: vi.fn(),
    };
    db.transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => fn(tx),
    );

    const service = createAccountService({ db: db as any });

    // Removing BIC from Russian bank should fail
    await expect(
      service.updateProvider(existing.id as string, { bic: null }),
    ).rejects.toThrow(ValidationError);
  });

  it("deletes a provider", async () => {
    const provider = makeProvider();
    const db = createStubDb();
    const tx = {
      select: vi
        .fn()
        .mockReturnValueOnce(selectWhereTerminal([{ count: 0 }])),
      delete: vi
        .fn()
        .mockReturnValueOnce(deleteReturning([{ id: provider.id }])),
      update: vi.fn(),
      insert: vi.fn(),
    };
    db.transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => fn(tx),
    );

    const service = createAccountService({ db: db as any });
    await service.deleteProvider(provider.id);

    expect(tx.delete).toHaveBeenCalledTimes(1);
  });

  it("throws AccountProviderNotFoundError when deleting missing provider", async () => {
    const db = createStubDb();
    const tx = {
      select: vi
        .fn()
        .mockReturnValueOnce(selectWhereTerminal([{ count: 0 }])),
      delete: vi.fn().mockReturnValueOnce(deleteReturning([])),
      update: vi.fn(),
      insert: vi.fn(),
    };
    db.transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => fn(tx),
    );

    const service = createAccountService({ db: db as any });

    await expect(service.deleteProvider("missing-id")).rejects.toThrow(
      AccountProviderNotFoundError,
    );
  });

  it("throws AccountProviderInUseError when provider has accounts", async () => {
    const db = createStubDb();
    const tx = {
      select: vi
        .fn()
        .mockReturnValueOnce(selectWhereTerminal([{ count: 3 }])),
      delete: vi.fn(),
      update: vi.fn(),
      insert: vi.fn(),
    };
    db.transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => fn(tx),
    );

    const service = createAccountService({ db: db as any });

    await expect(
      service.deleteProvider("00000000-0000-4000-8000-000000000301"),
    ).rejects.toThrow(AccountProviderInUseError);
    expect(tx.delete).not.toHaveBeenCalled();
  });

  it("lists providers with pagination", async () => {
    const p1 = makeProvider();
    const p2 = makeProvider({
      id: "00000000-0000-4000-8000-000000000302",
      name: "Deutsche Bank",
      country: "DE",
      bic: null,
      swift: "DEUTDEFF",
    });
    const db = createStubDb();
    db.select
      .mockReturnValueOnce(selectList([p1, p2]))
      .mockReturnValueOnce(selectWhereTerminal([{ total: 2 }]));

    const service = createAccountService({ db: db as any });
    const page = await service.listProviders({
      limit: 20,
      offset: 0,
      sortBy: "name",
      sortOrder: "asc",
    });

    expect(page).toEqual({
      data: [p1, p2],
      total: 2,
      limit: 20,
      offset: 0,
    });
  });

  it("lists providers with default query", async () => {
    const db = createStubDb();
    db.select
      .mockReturnValueOnce(selectList([]))
      .mockReturnValueOnce(selectWhereTerminal([{ total: 0 }]));

    const service = createAccountService({ db: db as any });
    const page = await service.listProviders();

    expect(page).toEqual({
      data: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

describe("accounts", () => {
  it("creates an account with bank provider", async () => {
    const provider = makeProvider();
    const account = makeAccount();
    const db = createStubDb();
    const tx = {
      select: vi
        .fn()
        .mockReturnValueOnce(selectSingleRow([provider])),
      insert: vi.fn().mockReturnValueOnce(insertReturning([account])),
      update: vi.fn(),
      delete: vi.fn(),
    };
    db.transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => fn(tx),
    );

    const service = createAccountService({ db: db as any });
    const result = await service.createAccount({
      counterpartyId: account.counterpartyId,
      currencyId: account.currencyId,
      accountProviderId: account.accountProviderId,
      label: account.label,
      stableKey: account.stableKey,
      accountNo: account.accountNo,
      corrAccount: account.corrAccount,
    });

    expect(result).toEqual(account);
    expect(tx.insert).toHaveBeenCalledTimes(1);
  });

  it("throws AccountProviderNotFoundError when creating with missing provider", async () => {
    const db = createStubDb();
    const tx = {
      select: vi.fn().mockReturnValueOnce(selectSingleRow([])),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    db.transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => fn(tx),
    );

    const service = createAccountService({ db: db as any });

    await expect(
      service.createAccount({
        counterpartyId: "00000000-0000-4000-8000-000000000501",
        currencyId: "00000000-0000-4000-8000-000000000601",
        accountProviderId: "00000000-0000-4000-8000-000000000999",
        label: "Test",
        stableKey: "test",
      }),
    ).rejects.toThrow(AccountProviderNotFoundError);
  });

  it("throws ValidationError when bank account missing accountNo", async () => {
    const provider = makeProvider({ type: "bank", country: "US" });
    const db = createStubDb();
    const tx = {
      select: vi
        .fn()
        .mockReturnValueOnce(selectSingleRow([provider])),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    db.transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => fn(tx),
    );

    const service = createAccountService({ db: db as any });

    await expect(
      service.createAccount({
        counterpartyId: "00000000-0000-4000-8000-000000000501",
        currencyId: "00000000-0000-4000-8000-000000000601",
        accountProviderId: provider.id as string,
        label: "Test",
        stableKey: "test",
      }),
    ).rejects.toThrow(ValidationError);
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("throws ValidationError when blockchain account missing address", async () => {
    const provider = makeProvider({
      id: "00000000-0000-4000-8000-000000000302",
      type: "blockchain",
      country: "US",
      bic: null,
      swift: null,
    });
    const db = createStubDb();
    const tx = {
      select: vi
        .fn()
        .mockReturnValueOnce(selectSingleRow([provider])),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    db.transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => fn(tx),
    );

    const service = createAccountService({ db: db as any });

    await expect(
      service.createAccount({
        counterpartyId: "00000000-0000-4000-8000-000000000501",
        currencyId: "00000000-0000-4000-8000-000000000601",
        accountProviderId: provider.id as string,
        label: "Test",
        stableKey: "test",
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("gets an account by ID", async () => {
    const account = makeAccount();
    const db = createStubDb();
    db.select.mockReturnValue(selectSingleRow([account]));

    const service = createAccountService({ db: db as any });
    const result = await service.getAccount(account.id);

    expect(result).toEqual(account);
  });

  it("throws AccountNotFoundError for missing account", async () => {
    const db = createStubDb();
    db.select.mockReturnValue(selectSingleRow([]));

    const service = createAccountService({ db: db as any });

    await expect(service.getAccount("missing-id")).rejects.toThrow(
      AccountNotFoundError,
    );
  });

  it("updates an account label", async () => {
    const provider = makeProvider();
    const existing = makeAccount();
    const updated = makeAccount({ label: "Новый счёт" });
    const db = createStubDb();
    const tx = {
      select: vi
        .fn()
        .mockReturnValueOnce(selectSingleRow([existing]))
        .mockReturnValueOnce(selectSingleRow([provider])),
      update: vi.fn().mockReturnValueOnce(updateReturning([updated])),
      insert: vi.fn(),
      delete: vi.fn(),
    };
    db.transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => fn(tx),
    );

    const service = createAccountService({ db: db as any });
    const result = await service.updateAccount(existing.id, {
      label: "Новый счёт",
    });

    expect(result).toEqual(updated);
    expect(tx.update).toHaveBeenCalledTimes(1);
  });

  it("returns existing when update has no fields", async () => {
    const provider = makeProvider();
    const existing = makeAccount();
    const db = createStubDb();
    const tx = {
      select: vi
        .fn()
        .mockReturnValueOnce(selectSingleRow([existing]))
        .mockReturnValueOnce(selectSingleRow([provider])),
      update: vi.fn(),
      insert: vi.fn(),
      delete: vi.fn(),
    };
    db.transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => fn(tx),
    );

    const service = createAccountService({ db: db as any });
    const result = await service.updateAccount(existing.id, {});

    expect(result).toEqual(existing);
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("throws AccountNotFoundError when updating missing account", async () => {
    const db = createStubDb();
    const tx = {
      select: vi.fn().mockReturnValueOnce(selectSingleRow([])),
      update: vi.fn(),
      insert: vi.fn(),
      delete: vi.fn(),
    };
    db.transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => fn(tx),
    );

    const service = createAccountService({ db: db as any });

    await expect(
      service.updateAccount("missing-id", { label: "Nope" }),
    ).rejects.toThrow(AccountNotFoundError);
  });

  it("throws AccountProviderNotFoundError when account's provider is missing during update", async () => {
    const existing = makeAccount();
    const db = createStubDb();
    const tx = {
      select: vi
        .fn()
        .mockReturnValueOnce(selectSingleRow([existing]))
        .mockReturnValueOnce(selectSingleRow([])),
      update: vi.fn(),
      insert: vi.fn(),
      delete: vi.fn(),
    };
    db.transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => fn(tx),
    );

    const service = createAccountService({ db: db as any });

    await expect(
      service.updateAccount(existing.id, { label: "Test" }),
    ).rejects.toThrow(AccountProviderNotFoundError);
  });

  it("rejects update that violates provider-dependent field rules", async () => {
    const provider = makeProvider({ type: "bank", country: "RU" });
    const existing = makeAccount();
    const db = createStubDb();
    const tx = {
      select: vi
        .fn()
        .mockReturnValueOnce(selectSingleRow([existing]))
        .mockReturnValueOnce(selectSingleRow([provider])),
      update: vi.fn(),
      insert: vi.fn(),
      delete: vi.fn(),
    };
    db.transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => fn(tx),
    );

    const service = createAccountService({ db: db as any });

    // Setting accountNo to null on a bank account should fail
    await expect(
      service.updateAccount(existing.id, { accountNo: null }),
    ).rejects.toThrow(ValidationError);
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("deletes an account", async () => {
    const account = makeAccount();
    const db = createStubDb();
    db.delete.mockReturnValue(deleteReturning([{ id: account.id }]));

    const service = createAccountService({ db: db as any });
    await service.deleteAccount(account.id);

    expect(db.delete).toHaveBeenCalledTimes(1);
  });

  it("throws AccountNotFoundError when deleting missing account", async () => {
    const db = createStubDb();
    db.delete.mockReturnValue(deleteReturning([]));

    const service = createAccountService({ db: db as any });

    await expect(service.deleteAccount("missing-id")).rejects.toThrow(
      AccountNotFoundError,
    );
  });

  it("lists accounts with pagination", async () => {
    const a1 = makeAccount();
    const a2 = makeAccount({
      id: "00000000-0000-4000-8000-000000000402",
      label: "Второй счёт",
      stableKey: "second-rub",
    });
    const db = createStubDb();
    db.select
      .mockReturnValueOnce(selectList([a1, a2]))
      .mockReturnValueOnce(selectWhereTerminal([{ total: 2 }]));

    const service = createAccountService({ db: db as any });
    const page = await service.listAccounts({
      limit: 10,
      offset: 0,
      sortBy: "label",
      sortOrder: "asc",
    });

    expect(page).toEqual({
      data: [a1, a2],
      total: 2,
      limit: 10,
      offset: 0,
    });
  });

  it("lists accounts with default query", async () => {
    const db = createStubDb();
    db.select
      .mockReturnValueOnce(selectList([]))
      .mockReturnValueOnce(selectWhereTerminal([{ total: 0 }]));

    const service = createAccountService({ db: db as any });
    const page = await service.listAccounts();

    expect(page).toEqual({
      data: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
  });

  it("lists accounts filtered by counterpartyId", async () => {
    const account = makeAccount();
    const db = createStubDb();
    db.select
      .mockReturnValueOnce(selectList([account]))
      .mockReturnValueOnce(selectWhereTerminal([{ total: 1 }]));

    const service = createAccountService({ db: db as any });
    const page = await service.listAccounts({
      counterpartyId: account.counterpartyId,
      limit: 20,
      offset: 0,
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    expect(page.data).toEqual([account]);
    expect(page.total).toBe(1);
  });
});
