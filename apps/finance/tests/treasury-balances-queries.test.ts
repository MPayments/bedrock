import { beforeEach, describe, expect, it, vi } from "vitest";

import { getTreasuryBalancesEvaluationTotal } from "@/features/treasury/balances/lib/queries";
import { ApiRequestError } from "@/lib/api/response";

const { getLatestRate } = vi.hoisted(() => ({
  getLatestRate: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/features/treasury/rates/lib/queries", () => ({
  getLatestRate,
}));

describe("treasury balances evaluation", () => {
  beforeEach(() => {
    getLatestRate.mockReset();
  });

  it("converts multi-currency balances into the selected evaluation currency", async () => {
    getLatestRate.mockImplementation(
      async (base: string, quote: string) => {
        if (base === "USD" && quote === "EUR") {
          return {
            asOf: "2026-04-02T10:15:00.000Z",
            base,
            quote,
            rateDen: "10",
            rateNum: "8",
            source: "manual",
          };
        }

        if (base === "GBP" && quote === "EUR") {
          return {
            asOf: "2026-04-02T10:15:00.000Z",
            base,
            quote,
            rateDen: "10",
            rateNum: "12",
            source: "manual",
          };
        }

        throw new Error(`unexpected pair ${base}/${quote}`);
      },
    );

    const summary = await getTreasuryBalancesEvaluationTotal({
      asOf: "2026-04-02T10:15:00.000Z",
      currencyAmounts: [
        { amount: "10", currency: "USD" },
        { amount: "5", currency: "GBP" },
        { amount: "2", currency: "EUR" },
      ],
      evaluationCurrency: "EUR",
    });

    expect(summary).toEqual({
      amount: "16",
      currency: "EUR",
      isComplete: true,
      missingCurrencies: [],
    });
  });

  it("returns an incomplete evaluation when a treasury rate is unavailable", async () => {
    getLatestRate.mockRejectedValue(
      new ApiRequestError(
        "Не удалось загрузить последний валютный курс",
        404,
        null,
      ),
    );

    const summary = await getTreasuryBalancesEvaluationTotal({
      asOf: "2026-04-02T10:15:00.000Z",
      currencyAmounts: [{ amount: "10", currency: "USD" }],
      evaluationCurrency: "EUR",
    });

    expect(summary).toEqual({
      amount: null,
      currency: "EUR",
      isComplete: false,
      missingCurrencies: ["USD"],
    });
  });
});
