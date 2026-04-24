import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DealPricingTab, serializeFormulaTrace } from "./deal-pricing-tab";
import type { ApiDealPricingQuote, ApiDealPricingRouteCandidate } from "./types";

function normalizeMarkupWhitespace(markup: string) {
  return markup.replace(/\s+/gu, " ").trim();
}

function createQuote(): ApiDealPricingQuote {
  return {
    benchmarks: {
      client: {
        asOf: "2026-04-19T16:47:00.000Z",
        baseCurrency: "RUB",
        quoteCurrency: "USD",
        rateDen: "1000000",
        rateNum: "12847",
        sourceKind: "client",
        sourceLabel: "Курс клиенту",
      },
      cost: {
        asOf: "2026-04-19T16:47:00.000Z",
        baseCurrency: "RUB",
        quoteCurrency: "USD",
        rateDen: "1000000",
        rateNum: "12803",
        sourceKind: "cost",
        sourceLabel: "Курс себестоимости",
      },
      market: {
        asOf: "2026-04-19T16:47:00.000Z",
        baseCurrency: "RUB",
        quoteCurrency: "USD",
        rateDen: "1000000",
        rateNum: "12670",
        sourceKind: "market",
        sourceLabel: "Рыночный курс",
      },
      pricingBase: "route_benchmark",
      routeBase: {
        asOf: "2026-04-19T16:47:00.000Z",
        baseCurrency: "RUB",
        quoteCurrency: "USD",
        rateDen: "1000000",
        rateNum: "12847",
        sourceKind: "route",
        sourceLabel: "Базовый курс маршрута",
      },
    },
    commercialTerms: null,
    createdAt: "2026-04-19T16:47:00.000Z",
    dealDirection: "buy",
    dealForm: "payment",
    dealId: "deal-1",
    expiresAt: "2026-04-20T16:47:00.000Z",
    formulaTrace: {
      sections: [
        {
          kind: "client_pricing",
          lines: [
            {
              currency: "RUB",
              expression: "1 000 000 USD × 77.836434 = 77 836 434 RUB",
              kind: "equation",
              label: "Цена клиенту",
              metadata: {},
              result: "77 836 434 RUB",
            },
          ],
          title: "Цена клиенту",
        },
      ],
    },
    fromAmountMinor: "7783643400",
    fromCurrency: "RUB",
    fromCurrencyId: "rub",
    id: "quote-1",
    idempotencyKey: "idem-1",
    pricingFingerprint: "fingerprint-1",
    pricingMode: "explicit_route",
    pricingTrace: {},
    profitability: {
      commercialRevenueMinor: "46701860",
      costPriceMinor: "7810886152",
      currency: "RUB",
      customerPrincipalMinor: "7783643400",
      customerTotalMinor: "7791427043",
      passThroughMinor: "7783643",
      profitMinor: "19459108",
      profitPercentOnCost: "0.25",
    },
    rateDen: "1000000",
    rateNum: "12847",
    status: "accepted",
    toAmountMinor: "100000000",
    toCurrency: "USD",
    toCurrencyId: "usd",
    usedAt: null,
    usedByRef: null,
    usedDocumentId: null,
  };
}

function createRouteCandidate(): ApiDealPricingRouteCandidate {
  return {
    createdAt: "2026-04-19T16:40:00.000Z",
    currencyInId: "rub",
    currencyOutId: "usd",
    destinationEndpoint: {
      binding: "abstract",
      displayName: "Получатель",
      entityId: null,
      entityKind: null,
      nodeId: "node-destination",
      requisiteId: null,
      role: "destination",
    },
    hopCount: 2,
    id: "route-template-1",
    lastCalculation: null,
    name: "Новый маршрут",
    snapshotPolicy: "copy_on_attach",
    sourceEndpoint: {
      binding: "abstract",
      displayName: "Плательщик",
      entityId: null,
      entityKind: null,
      nodeId: "node-source",
      requisiteId: null,
      role: "source",
    },
    status: "active",
    updatedAt: "2026-04-19T16:41:00.000Z",
  };
}

describe("DealPricingTab", () => {
  it("renders the compact manager workflow", () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const quote = createQuote();
    const routeCandidate = createRouteCandidate();
    const markup = renderToStaticMarkup(
      createElement(DealPricingTab, {
        acceptedQuote: {
          acceptedAt: "2026-04-19T16:47:00.000Z",
          acceptedByUserId: "user-1",
          agreementVersionId: null,
          dealId: "deal-1",
          dealRevision: 5,
          expiresAt: "2026-04-20T16:47:00.000Z",
          id: "acceptance-1",
          quoteId: quote.id,
          quoteStatus: "accepted",
          replacedByQuoteId: null,
          revocationReason: null,
          revokedAt: null,
          usedAt: null,
          usedDocumentId: null,
        },
        amountCurrencyPrecision: 2,
        currencyOptions: [
          { code: "RUB", id: "rub", label: "RUB", name: "Russian Ruble" },
          { code: "USD", id: "usd", label: "USD", name: "US Dollar" },
          { code: "AED", id: "aed", label: "AED", name: "UAE Dirham" },
        ],
        dealId: "deal-1",
        fundingDeadline: "2026-04-22T23:59:00.000Z",
        initialRequestedAmount: "1000000",
        onError: vi.fn(),
        onReload: vi.fn(async () => {}),
        pricingContext: {
          commercialDraft: {
            fixedFeeAmount: null,
            fixedFeeCurrency: null,
            quoteMarkupBps: 50,
          },
          fundingAdjustments: [],
          revision: 5,
          routeAttachment: {
            attachedAt: "2026-04-19T16:42:00.000Z",
            snapshot: {
              additionalFees: [
                {
                  chargeToCustomer: true,
                  id: "fee-1",
                  kind: "gross_percent",
                  label: "Комиссия",
                  percentage: "0.10",
                },
              ],
              amountInMinor: "7783643400",
              amountOutMinor: "100000000",
              currencyInId: "rub",
              currencyOutId: "usd",
              legs: [
                {
                  fees: [],
                  fromCurrencyId: "rub",
                  id: "leg-1",
                  idx: 1,
                  toCurrencyId: "rub",
                },
                {
                  fees: [
                    {
                      chargeToCustomer: false,
                      id: "fee-2",
                      kind: "gross_percent",
                      label: "Комиссия",
                      percentage: "0.25",
                    },
                  ],
                  fromCurrencyId: "rub",
                  id: "leg-2",
                  idx: 2,
                  toCurrencyId: "aed",
                },
                {
                  fees: [],
                  fromCurrencyId: "aed",
                  id: "leg-3",
                  idx: 3,
                  toCurrencyId: "aed",
                },
                {
                  fees: [],
                  fromCurrencyId: "aed",
                  id: "leg-4",
                  idx: 4,
                  toCurrencyId: "usd",
                },
              ],
              lockedSide: "currency_out",
              participants: [],
            },
            templateId: routeCandidate.id,
            templateName: routeCandidate.name,
          },
        },
        quoteAmountSide: "target",
        quoteCreationDisabledReason: null,
        quotes: [quote],
        targetCurrencyPrecision: 2,
      }),
    );

    const normalizedMarkup = normalizeMarkupWhitespace(markup);

    expect(normalizedMarkup).toContain("Котировка");
    expect(normalizedMarkup).toContain("Входные данные");
    expect(normalizedMarkup).toContain("Маршрут");
    expect(normalizedMarkup).toContain("Наценка к курсу");
    expect(normalizedMarkup).toContain("Зафиксировать новый курс");
    expect(normalizedMarkup).toContain("Копировать расчёт");
    expect(normalizedMarkup).toContain("Скачать PDF");
    expect(normalizedMarkup).toContain("Курс зафиксирован до");
    expect(normalizedMarkup).toContain("Котировка истекает");
    expect(normalizedMarkup).toContain("Срок фондирования");
    expect(normalizedMarkup).toContain("История котировок (0)");
  });
});

describe("serializeFormulaTrace", () => {
  it("returns an empty string for null or empty traces", () => {
    expect(serializeFormulaTrace(null)).toBe("");
    expect(serializeFormulaTrace(undefined)).toBe("");
    expect(serializeFormulaTrace({ sections: [] })).toBe("");
  });

  it("renders equation lines verbatim and note lines as label: expression", () => {
    const text = serializeFormulaTrace({
      sections: [
        {
          kind: "client_pricing",
          title: "Цена клиенту",
          lines: [
            {
              currency: "RUB",
              expression: "1 000 000 USD × 77.84 = 77 840 000 RUB",
              kind: "equation",
              label: "Расчёт",
              metadata: {},
              result: "77 840 000 RUB",
            },
            {
              currency: null,
              expression: "наценка 0.50%",
              kind: "note",
              label: "Наценка",
              metadata: {},
              result: "0.50%",
            },
          ],
        },
      ],
    });

    expect(text).toBe(
      [
        "Цена клиенту",
        "1 000 000 USD × 77.84 = 77 840 000 RUB",
        "Наценка: наценка 0.50%",
      ].join("\n"),
    );
  });

  it("separates multiple sections with a blank line", () => {
    const text = serializeFormulaTrace({
      sections: [
        {
          kind: "client_pricing",
          title: "Первый",
          lines: [
            {
              currency: null,
              expression: "A = B",
              kind: "equation",
              label: "l",
              metadata: {},
              result: "B",
            },
          ],
        },
        {
          kind: "route_execution",
          title: "Второй",
          lines: [
            {
              currency: null,
              expression: "C = D",
              kind: "equation",
              label: "l",
              metadata: {},
              result: "D",
            },
          ],
        },
      ],
    });

    expect(text).toBe(
      ["Первый", "A = B", "", "Второй", "C = D"].join("\n"),
    );
  });
});
