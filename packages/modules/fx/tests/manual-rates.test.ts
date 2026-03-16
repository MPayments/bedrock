import { describe, expect, it, vi } from "vitest";

import { ValidationError } from "@bedrock/shared/core/errors";

import { createFxRateCommandHandlers } from "../src/application/rates/commands";

function createContext() {
  const insertManualRate = vi.fn(async () => undefined);
  const currenciesService = {
    findByCode: vi.fn(async (code: string) => ({
      id: `cur-${code.toLowerCase()}`,
      code,
    })),
  } as any;

  return {
    insertManualRate,
    context: {
      currenciesService,
      ratesRepository: {
        insertManualRate,
      },
      quotesRepository: {
        expireOldQuotes: vi.fn(async () => undefined),
      },
      log: {
        warn: vi.fn(),
      },
      rateSourceProviders: {},
    } as any,
  };
}

describe("manual rate handlers", () => {
  it("persists manual source by default and invalidates cache", async () => {
    const { context, insertManualRate } = createContext();
    const handlers = createFxRateCommandHandlers(context);

    const asOf = new Date("2026-02-19T00:00:00.000Z");
    await handlers.setManualRate({
      base: "USD",
      quote: "EUR",
      rateNum: 100n,
      rateDen: 99n,
      asOf,
    });

    expect(insertManualRate).toHaveBeenCalledWith({
      baseCurrencyId: "cur-usd",
      quoteCurrencyId: "cur-eur",
      rateNum: 100n,
      rateDen: 99n,
      asOf,
      source: "manual",
    });
  });

  it("persists explicit non-cbr source", async () => {
    const { context, insertManualRate } = createContext();
    const handlers = createFxRateCommandHandlers(context);

    await handlers.setManualRate({
      base: "USD",
      quote: "EUR",
      rateNum: 101n,
      rateDen: 100n,
      asOf: new Date("2026-02-19T00:00:00.000Z"),
      source: "bank",
    });

    expect(insertManualRate).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "bank",
      }),
    );
  });

  it("rejects reserved cbr source before repository write", async () => {
    const { context, insertManualRate } = createContext();
    const handlers = createFxRateCommandHandlers(context);

    await expect(
      handlers.setManualRate({
        base: "USD",
        quote: "EUR",
        rateNum: 1n,
        rateDen: 1n,
        asOf: new Date("2026-02-19T00:00:00.000Z"),
        source: "cbr",
      }),
    ).rejects.toThrow(ValidationError);

    expect(insertManualRate).not.toHaveBeenCalled();
  });
});
