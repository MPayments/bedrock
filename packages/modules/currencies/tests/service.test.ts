import { describe, expect, it, vi } from "vitest";
import { createCurrenciesService } from "../src/service";
import {
  CurrencyDeleteConflictError,
  CurrencyNotFoundError,
} from "../src/errors";

function makeCurrency(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000101",
    name: "US Dollar",
    code: "USD",
    symbol: "$",
    precision: 2,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function createStubDb() {
  return {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

describe("createCurrenciesService", () => {
  it("lists currencies with pagination", async () => {
    const usd = makeCurrency();
    const eur = makeCurrency({
      id: "00000000-0000-4000-8000-000000000102",
      name: "Euro",
      code: "EUR",
      symbol: "EUR",
    });
    const gbp = makeCurrency({
      id: "00000000-0000-4000-8000-000000000103",
      name: "Pound Sterling",
      code: "GBP",
      symbol: "GBP",
    });
    const db = createStubDb();
    db.select.mockReturnValue({
      from: vi.fn(async () => [usd, eur, gbp]),
    });

    const service = createCurrenciesService({ db: db as any });
    const page = await service.list({ limit: 2, offset: 1 });

    expect(page.total).toBe(3);
    expect(page.limit).toBe(2);
    expect(page.offset).toBe(1);
    expect(page.data).toEqual([eur, gbp]);
  });

  it("applies text/precision filters and supports all sort columns", async () => {
    const usd = makeCurrency();
    const eur = makeCurrency({
      id: "00000000-0000-4000-8000-000000000102",
      name: "Euro",
      code: "EUR",
      symbol: "€",
      precision: 2,
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    const jpy = makeCurrency({
      id: "00000000-0000-4000-8000-000000000103",
      name: "Japanese Yen",
      code: "JPY",
      symbol: "JPY",
      precision: 0,
      updatedAt: new Date("2026-01-03T00:00:00.000Z"),
    });
    const db = createStubDb();
    db.select.mockReturnValue({
      from: vi.fn(async () => [usd, eur, jpy]),
    });

    const service = createCurrenciesService({ db: db as any });

    const filtered = await service.list({
      name: "dollar",
      code: "us",
      symbol: "$",
      precision: 2,
      sortBy: "code",
      sortOrder: "asc",
      limit: 20,
      offset: 0,
    });
    await service.list({ sortBy: "name", sortOrder: "asc" });
    await service.list({ sortBy: "symbol", sortOrder: "asc" });
    await service.list({ sortBy: "precision", sortOrder: "asc" });
    await service.list({ sortBy: "updatedAt", sortOrder: "asc" });

    expect(filtered.data).toEqual([usd]);
  });

  it("warms cache once and resolves by code/id case-insensitively", async () => {
    const usd = makeCurrency();
    const db = createStubDb();
    db.select.mockReturnValue({
      from: vi.fn(async () => [usd]),
    });

    const service = createCurrenciesService({ db: db as any });

    const byCode = await service.findByCode("usd");
    const byId = await service.findById(usd.id);

    expect(byCode).toEqual(usd);
    expect(byId).toEqual(usd);
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it("throws CurrencyNotFoundError for unknown code and id", async () => {
    const db = createStubDb();
    db.select.mockReturnValue({
      from: vi.fn(async () => [makeCurrency()]),
    });

    const service = createCurrenciesService({ db: db as any });

    await expect(service.findByCode("RUB")).rejects.toThrow(
      CurrencyNotFoundError,
    );
    await expect(service.findById("missing-id")).rejects.toThrow(
      CurrencyNotFoundError,
    );
  });

  it("invalidates cache after create", async () => {
    const usd = makeCurrency();
    const eur = makeCurrency({
      id: "00000000-0000-4000-8000-000000000102",
      name: "Euro",
      code: "EUR",
      symbol: "EUR",
    });
    const db = createStubDb();
    db.select
      .mockReturnValueOnce({
        from: vi.fn(async () => [usd]),
      })
      .mockReturnValueOnce({
        from: vi.fn(async () => [usd, eur]),
      });
    db.insert.mockReturnValue({
      values: vi.fn(() => ({
        returning: vi.fn(async () => [eur]),
      })),
    });

    const service = createCurrenciesService({ db: db as any });

    await service.findByCode("USD");
    const created = await service.create({
      name: eur.name,
      code: eur.code,
      symbol: eur.symbol,
      precision: eur.precision,
    });
    const resolved = await service.findByCode("EUR");

    expect(created).toEqual(eur);
    expect(resolved).toEqual(eur);
    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it("invalidates cache after update and throws when update target missing", async () => {
    const usd = makeCurrency();
    const updatedUsd = makeCurrency({ name: "Updated Dollar" });
    const db = createStubDb();
    db.select
      .mockReturnValueOnce({
        from: vi.fn(async () => [usd]),
      })
      .mockReturnValueOnce({
        from: vi.fn(async () => [updatedUsd]),
      });
    db.update
      .mockReturnValueOnce({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => [updatedUsd]),
          })),
        })),
      })
      .mockReturnValueOnce({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => []),
          })),
        })),
      });

    const service = createCurrenciesService({ db: db as any });

    await service.findByCode("USD");
    const updated = await service.update(usd.id, { name: "Updated Dollar" });
    const resolved = await service.findById(usd.id);

    expect(updated).toEqual(updatedUsd);
    expect(resolved).toEqual(updatedUsd);
    expect(db.select).toHaveBeenCalledTimes(2);

    await expect(
      service.update("missing-id", { name: "Nope" }),
    ).rejects.toThrow(CurrencyNotFoundError);
  });

  it("removes currency, invalidates cache and fails to resolve removed code", async () => {
    const usd = makeCurrency();
    const db = createStubDb();
    db.select
      .mockReturnValueOnce({
        from: vi.fn(async () => [usd]),
      })
      .mockReturnValueOnce({
        from: vi.fn(async () => []),
      });
    db.delete.mockReturnValue({
      where: vi.fn(() => ({
        returning: vi.fn(async () => [{ id: usd.id }]),
      })),
    });

    const service = createCurrenciesService({ db: db as any });

    await service.findByCode("USD");
    await service.remove(usd.id);

    await expect(service.findByCode("USD")).rejects.toThrow(
      CurrencyNotFoundError,
    );
    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it("throws CurrencyNotFoundError when remove target is missing", async () => {
    const db = createStubDb();
    db.delete.mockReturnValue({
      where: vi.fn(() => ({
        returning: vi.fn(async () => []),
      })),
    });

    const service = createCurrenciesService({ db: db as any });

    await expect(service.remove("missing-id")).rejects.toThrow(
      CurrencyNotFoundError,
    );
  });

  it("maps foreign key delete conflicts to CurrencyDeleteConflictError", async () => {
    const db = createStubDb();
    db.delete.mockReturnValue({
      where: vi.fn(() => ({
        returning: vi.fn(async () => {
          const error = new Error("foreign key conflict");
          (error as Error & { cause?: unknown }).cause = { code: "23503" };
          throw error;
        }),
      })),
    });

    const service = createCurrenciesService({ db: db as any });

    await expect(service.remove("in-use-id")).rejects.toThrow(
      CurrencyDeleteConflictError,
    );
  });

  it("sorts by code for multi-item lists", async () => {
    const usd = makeCurrency({ code: "USD" });
    const eur = makeCurrency({
      id: "00000000-0000-4000-8000-000000000102",
      code: "EUR",
    });
    const jpy = makeCurrency({
      id: "00000000-0000-4000-8000-000000000103",
      code: "JPY",
    });
    const db = createStubDb();
    db.select.mockReturnValue({
      from: vi.fn(async () => [usd, eur, jpy]),
    });

    const service = createCurrenciesService({ db: db as any });
    const result = await service.list({
      sortBy: "code",
      sortOrder: "asc",
      limit: 10,
      offset: 0,
    });

    expect(result.data.map((currency) => currency.code)).toEqual([
      "EUR",
      "JPY",
      "USD",
    ]);
  });
});
