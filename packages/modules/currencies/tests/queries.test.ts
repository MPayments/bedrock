import { describe, expect, it, vi } from "vitest";

import { createCurrenciesQueries } from "../src/queries";

describe("createCurrenciesQueries", () => {
  it("returns precisions by currency code", async () => {
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(async () => [
            { code: "USD", precision: 2 },
            { code: "JPY", precision: 0 },
          ]),
        })),
      })),
    };

    const queries = createCurrenciesQueries({ db: db as any });
    const result = await queries.listPrecisionsByCode([" usd ", "JPY", ""]);

    expect(result).toEqual(
      new Map([
        ["USD", 2],
        ["JPY", 0],
      ]),
    );
  });

  it("returns currencies by id", async () => {
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(async () => [
            {
              id: "currency-usd",
              code: "USD",
              name: "US Dollar",
              symbol: "$",
              precision: 2,
              createdAt: new Date("2025-01-01T00:00:00.000Z"),
              updatedAt: new Date("2025-01-01T00:00:00.000Z"),
            },
          ]),
        })),
      })),
    };

    const queries = createCurrenciesQueries({ db: db as any });
    const result = await queries.listByIds([" currency-usd ", ""]);

    expect(result).toEqual(
      new Map([
        [
          "currency-usd",
          {
            id: "currency-usd",
            code: "USD",
            name: "US Dollar",
            symbol: "$",
            precision: 2,
            createdAt: new Date("2025-01-01T00:00:00.000Z"),
            updatedAt: new Date("2025-01-01T00:00:00.000Z"),
          },
        ],
      ]),
    );
  });
});
