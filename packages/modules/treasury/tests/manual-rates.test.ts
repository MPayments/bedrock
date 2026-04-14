import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { SetManualRateCommand } from "../src/rates/application/commands/set-manual-rate";

function createManualRateHarness() {
  const insertManualRate = vi.fn(async () => undefined);
  const currencies = {
    findByCode: vi.fn(async (code: string) => ({
      id: `cur-${code.toLowerCase()}`,
      code,
    })),
  } as any;

  return {
    insertManualRate,
    currencies,
    ratesRepository: {
      insertManualRate,
    },
  };
}

describe("manual rate handlers", () => {
  it("persists manual source by default and invalidates cache", async () => {
    const { currencies, insertManualRate, ratesRepository } =
      createManualRateHarness();
    const invalidateRateCache = vi.fn();
    const command = new SetManualRateCommand(
      () => new Date("2026-02-19T00:00:00.000Z"),
      currencies as any,
      ratesRepository as any,
      invalidateRateCache,
    );

    const asOf = new Date("2026-02-19T00:00:00.000Z");
    await command.execute({
      base: "USD",
      quote: "EUR",
      rateNum: 100n,
      rateDen: 99n,
      asOf,
    });

    expect(insertManualRate).toHaveBeenNthCalledWith(1, {
      baseCurrencyId: "cur-usd",
      quoteCurrencyId: "cur-eur",
      rateNum: 100n,
      rateDen: 99n,
      asOf,
      source: "manual",
    });
    expect(insertManualRate).toHaveBeenNthCalledWith(2, {
      baseCurrencyId: "cur-eur",
      quoteCurrencyId: "cur-usd",
      rateNum: 99n,
      rateDen: 100n,
      asOf,
      source: "manual",
    });
    expect(invalidateRateCache).toHaveBeenCalledTimes(1);
  });

  it("persists explicit non-cbr source", async () => {
    const { currencies, insertManualRate, ratesRepository } =
      createManualRateHarness();
    const command = new SetManualRateCommand(
      () => new Date("2026-02-19T00:00:00.000Z"),
      currencies as any,
      ratesRepository as any,
      vi.fn(),
    );

    await command.execute({
      base: "USD",
      quote: "EUR",
      rateNum: 101n,
      rateDen: 100n,
      asOf: new Date("2026-02-19T00:00:00.000Z"),
      source: "bank",
    });

    expect(insertManualRate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        source: "bank",
      }),
    );
    expect(insertManualRate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        source: "bank",
      }),
    );
  });

  it("rejects reserved cbr source before repository write", async () => {
    const { currencies, insertManualRate, ratesRepository } =
      createManualRateHarness();
    const command = new SetManualRateCommand(
      () => new Date("2026-02-19T00:00:00.000Z"),
      currencies as any,
      ratesRepository as any,
      vi.fn(),
    );

    await expect(
      command.execute({
        base: "USD",
        quote: "EUR",
        rateNum: 1n,
        rateDen: 1n,
        asOf: new Date("2026-02-19T00:00:00.000Z"),
        source: "cbr",
      }),
    ).rejects.toThrow(z.ZodError);

    expect(insertManualRate).not.toHaveBeenCalled();
  });
});
