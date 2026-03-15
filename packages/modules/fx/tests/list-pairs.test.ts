import { describe, expect, it, vi } from "vitest";

import { createDrizzleFxRatesRepository } from "../src/infra/drizzle/repos/rates-repository";

describe("list pairs repository", () => {
  it("groups pair rows, computes changes and sorts sources by priority", async () => {
    const db = {
      execute: vi.fn(async () => ({
        rows: [
          {
            source: "investing",
            rate_num: "111",
            rate_den: "100",
            as_of: "2026-02-27T00:00:00.000Z",
            base_code: "USD",
            quote_code: "EUR",
            rn: "1",
          },
          {
            source: "manual",
            rate_num: "110",
            rate_den: "100",
            as_of: "2026-02-27T00:00:00.000Z",
            base_code: "USD",
            quote_code: "EUR",
            rn: "1",
          },
          {
            source: "manual",
            rate_num: "100",
            rate_den: "100",
            as_of: "2026-02-26T00:00:00.000Z",
            base_code: "USD",
            quote_code: "EUR",
            rn: "2",
          },
          {
            source: "cbr",
            rate_num: "109",
            rate_den: "100",
            as_of: "2026-02-27T00:00:00.000Z",
            base_code: "USD",
            quote_code: "EUR",
            rn: "1",
          },
        ],
      })),
    } as any;

    const repository = createDrizzleFxRatesRepository(db);
    const pairs = await repository.listPairs();

    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.baseCurrencyCode).toBe("USD");
    expect(pairs[0]!.quoteCurrencyCode).toBe("EUR");
    expect(pairs[0]!.bestRate.source).toBe("manual");
    expect(pairs[0]!.rates.map((rate) => rate.source)).toEqual([
      "manual",
      "cbr",
      "investing",
    ]);
    expect(pairs[0]!.rates[0]!.change).toBeCloseTo(0.1, 8);
    expect(pairs[0]!.rates[0]!.changePercent).toBeCloseTo(10, 8);
  });

  it("keeps change values null when previous rate is zero", async () => {
    const db = {
      execute: vi.fn(async () => ({
        rows: [
          {
            source: "manual",
            rate_num: "1",
            rate_den: "1",
            as_of: "2026-02-27T00:00:00.000Z",
            base_code: "EUR",
            quote_code: "USD",
            rn: "1",
          },
          {
            source: "manual",
            rate_num: "0",
            rate_den: "1",
            as_of: "2026-02-26T00:00:00.000Z",
            base_code: "EUR",
            quote_code: "USD",
            rn: "2",
          },
        ],
      })),
    } as any;

    const repository = createDrizzleFxRatesRepository(db);
    const pairs = await repository.listPairs();

    expect(pairs[0]!.rates[0]!.change).toBeNull();
    expect(pairs[0]!.rates[0]!.changePercent).toBeNull();
  });

  it("returns empty list when no rates are present", async () => {
    const repository = createDrizzleFxRatesRepository({
      execute: vi.fn(async () => ({ rows: [] })),
    } as any);

    const pairs = await repository.listPairs();
    expect(pairs).toEqual([]);
  });

  it("sorts resulting pairs by base and quote currency codes", async () => {
    const repository = createDrizzleFxRatesRepository({
      execute: vi.fn(async () => ({
        rows: [
          {
            source: "manual",
            rate_num: "1",
            rate_den: "1",
            as_of: "2026-02-27T00:00:00.000Z",
            base_code: "USD",
            quote_code: "RUB",
            rn: "1",
          },
          {
            source: "manual",
            rate_num: "1",
            rate_den: "1",
            as_of: "2026-02-27T00:00:00.000Z",
            base_code: "EUR",
            quote_code: "USD",
            rn: "1",
          },
        ],
      })),
    } as any);

    const pairs = await repository.listPairs();

    expect(
      pairs.map((pair) => `${pair.baseCurrencyCode}/${pair.quoteCurrencyCode}`),
    ).toEqual(["EUR/USD", "USD/RUB"]);
  });

  it("throws for unknown source in result set", async () => {
    const repository = createDrizzleFxRatesRepository({
      execute: vi.fn(async () => ({
        rows: [
          {
            source: "manual",
            rate_num: "1",
            rate_den: "1",
            as_of: "2026-02-27T00:00:00.000Z",
            base_code: "USD",
            quote_code: "RUB",
            rn: "1",
          },
          {
            source: "unknown",
            rate_num: "1",
            rate_den: "1",
            as_of: "2026-02-27T00:00:00.000Z",
            base_code: "USD",
            quote_code: "RUB",
            rn: "1",
          },
        ],
      })),
    } as any);

    await expect(repository.listPairs()).rejects.toThrow(
      "Unknown FX rate source: unknown",
    );
  });
});
