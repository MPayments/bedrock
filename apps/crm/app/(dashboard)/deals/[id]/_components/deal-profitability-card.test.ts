import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DealProfitabilityCard } from "./deal-profitability-card";

function normalizeMarkupWhitespace(markup: string) {
  return markup.replace(/\s+/gu, " ").trim();
}

describe("DealProfitabilityCard", () => {
  it("renders plan vs actual profitability summary", () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const markup = renderToStaticMarkup(
      createElement(DealProfitabilityCard, {
        profitabilitySnapshot: {
          calculationId: "calculation-1",
          feeRevenue: [
            {
              amountMinor: "120",
              currencyCode: "USD",
              currencyId: "currency-usd",
            },
          ],
          providerFeeExpense: [
            {
              amountMinor: "30",
              currencyCode: "USD",
              currencyId: "currency-usd",
            },
          ],
          spreadRevenue: [
            {
              amountMinor: "80",
              currencyCode: "USD",
              currencyId: "currency-usd",
            },
          ],
          totalRevenue: [
            {
              amountMinor: "200",
              currencyCode: "USD",
              currencyId: "currency-usd",
            },
          ],
        },
        profitabilityVariance: {
          actualCoverage: {
            factCount: 2,
            legsWithFacts: 2,
            operationCount: 2,
            state: "complete",
            terminalOperationCount: 2,
            totalLegCount: 2,
          },
          actualExpense: [],
          actualPassThrough: [],
          calculationId: "calculation-1",
          expectedNetMargin: [
            {
              amountMinor: "170",
              currencyCode: "USD",
              currencyId: "currency-usd",
            },
          ],
          netMarginVariance: [
            {
              amountMinor: "-15",
              currencyCode: "USD",
              currencyId: "currency-usd",
            },
          ],
          realizedNetMargin: [
            {
              amountMinor: "155",
              currencyCode: "USD",
              currencyId: "currency-usd",
            },
          ],
          varianceByCostFamily: [
            {
              actual: [
                {
                  amountMinor: "30",
                  currencyCode: "USD",
                  currencyId: "currency-usd",
                },
              ],
              classification: "expense",
              expected: [
                {
                  amountMinor: "20",
                  currencyCode: "USD",
                  currencyId: "currency-usd",
                },
              ],
              family: "provider_fee",
              variance: [
                {
                  amountMinor: "10",
                  currencyCode: "USD",
                  currencyId: "currency-usd",
                },
              ],
            },
          ],
          varianceByLeg: [],
        },
      }),
    );

    const normalizedMarkup = normalizeMarkupWhitespace(markup);

    expect(normalizedMarkup).toContain("Финансовый результат");
    expect(normalizedMarkup).toContain("Факты собраны");
    expect(normalizedMarkup).toContain("Ожидаемая чистая маржа");
    expect(normalizedMarkup).toContain("1.70 USD");
    expect(normalizedMarkup).toContain("Реализованная маржа");
    expect(normalizedMarkup).toContain("1.55 USD");
    expect(normalizedMarkup).toContain("provider fee");
  });
});
