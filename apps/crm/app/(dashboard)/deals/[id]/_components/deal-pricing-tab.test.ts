import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DealPricingTab } from "./deal-pricing-tab";
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
  it("renders the compact manager workflow without manual save or preview actions", () => {
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
          revokedAt: null,
          usedAt: null,
          usedDocumentId: null,
        },
        activeCalculationId: null,
        amountCurrencyCode: "USD",
        amountCurrencyPrecision: 2,
        calculation: null,
        calculationDisabledReason: null,
        calculationHistory: [],
        currencyOptions: [
          { code: "RUB", id: "rub", label: "RUB", name: "Russian Ruble" },
          { code: "USD", id: "usd", label: "USD", name: "US Dollar" },
          { code: "AED", id: "aed", label: "AED", name: "UAE Dirham" },
        ],
        dealId: "deal-1",
        initialRequestedAmount: "1000000",
        isAcceptingQuoteId: null,
        isCreatingCalculation: false,
        onAcceptQuote: vi.fn(),
        onCreateCalculation: vi.fn(),
        onError: vi.fn(),
        onReload: vi.fn(async () => {}),
        pricingContext: {
          commercialDraft: {
            fixedFeeAmount: null,
            fixedFeeCurrency: null,
            quoteMarkupPercent: "0.5",
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
                  kind: "percent",
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
                      kind: "percent",
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
        targetCurrencyCode: "RUB",
        targetCurrencyPrecision: 2,
      }),
    );

    const normalizedMarkup = normalizeMarkupWhitespace(markup);

    expect(normalizedMarkup).toContain("Маршрут платежа");
    expect(normalizedMarkup).toContain("Цена клиенту");
    expect(normalizedMarkup).toContain("Ключевые показатели");
    expect(normalizedMarkup).toContain("Текущая принятая котировка");
    expect(normalizedMarkup).toContain("Детали расчета");
    expect(normalizedMarkup).toContain("Создать котировку");
    expect(normalizedMarkup).toContain("Зафиксировать расчет");
    expect(normalizedMarkup).not.toContain("Сохранить условия");
    expect(normalizedMarkup).not.toContain(">Рассчитать<");
  });
});
