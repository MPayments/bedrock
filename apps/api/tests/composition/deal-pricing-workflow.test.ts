import { describe, expect, it, vi } from "vitest";

import { DealPricingContextRevisionConflictError } from "@bedrock/deals";

import { createDealPricingWorkflow } from "../../src/composition/deal-pricing-workflow";

const IDS = {
  aed: "00000000-0000-4000-8000-000000000102",
  customer: "00000000-0000-4000-8000-000000000001",
  deal: "00000000-0000-4000-8000-000000000010",
  otherCustomer: "00000000-0000-4000-8000-000000000099",
  route: "00000000-0000-4000-8000-000000000020",
  rub: "00000000-0000-4000-8000-000000000101",
  usd: "00000000-0000-4000-8000-000000000103",
} as const;

function createRouteSnapshot() {
  return {
    additionalFees: [
      {
        amountMinor: "300",
        chargeToCustomer: false,
        currencyId: IDS.rub,
        id: "additional-internal",
        kind: "fixed",
        label: "Internal ops fee",
      },
      {
        amountMinor: "150",
        chargeToCustomer: true,
        currencyId: IDS.rub,
        id: "additional-charged",
        kind: "fixed",
        label: "Client service fee",
      },
    ],
    amountInMinor: "79005226",
    amountOutMinor: "101819387",
    currencyInId: IDS.rub,
    currencyOutId: IDS.usd,
    legs: [
      {
        fees: [
          {
            amountMinor: "200",
            chargeToCustomer: true,
            currencyId: IDS.rub,
            id: "leg-fee-charged",
            kind: "fixed",
            label: "Bank fee",
          },
        ],
        fromCurrencyId: IDS.rub,
        id: "leg-1",
        toCurrencyId: IDS.aed,
      },
      {
        fees: [],
        fromCurrencyId: IDS.aed,
        id: "leg-2",
        toCurrencyId: IDS.usd,
      },
    ],
    lockedSide: "currency_in",
    participants: [
      {
        binding: "bound",
        displayName: "Acme",
        entityId: IDS.customer,
        entityKind: "customer",
        nodeId: "node-source",
        requisiteId: null,
        role: "source",
      },
      {
        binding: "abstract",
        displayName: "Beneficiary",
        entityId: null,
        entityKind: null,
        nodeId: "node-destination",
        requisiteId: null,
        role: "destination",
      },
    ],
  } as const;
}

function createRoutePreview() {
  return {
    additionalFees: [
      {
        amountMinor: "300",
        chargeToCustomer: false,
        currencyId: IDS.rub,
        id: "additional-internal",
        inputImpactCurrencyId: IDS.rub,
        inputImpactMinor: "300",
        kind: "fixed",
        label: "Internal ops fee",
        outputImpactCurrencyId: IDS.usd,
        outputImpactMinor: "4",
        routeInputImpactMinor: "300",
      },
      {
        amountMinor: "150",
        chargeToCustomer: true,
        currencyId: IDS.rub,
        id: "additional-charged",
        inputImpactCurrencyId: IDS.rub,
        inputImpactMinor: "150",
        kind: "fixed",
        label: "Client service fee",
        outputImpactCurrencyId: IDS.usd,
        outputImpactMinor: "2",
        routeInputImpactMinor: "150",
      },
    ],
    amountInMinor: "79005226",
    amountOutMinor: "101819387",
    chargedFeeTotals: [
      {
        amountMinor: "350",
        currencyId: IDS.rub,
      },
    ],
    cleanAmountOutMinor: "101819387",
    clientTotalInMinor: "79005376",
    computedAt: "2026-04-19T09:58:00.000Z",
    costPriceInMinor: "79005676",
    currencyInId: IDS.rub,
    currencyOutId: IDS.usd,
    feeTotals: [
      {
        amountMinor: "650",
        currencyId: IDS.rub,
      },
    ],
    grossAmountOutMinor: "101819387",
    internalFeeTotals: [
      {
        amountMinor: "300",
        currencyId: IDS.rub,
      },
    ],
    legs: [
      {
        asOf: "2026-04-19T09:58:00.000Z",
        fees: [
          {
            amountMinor: "200",
            chargeToCustomer: true,
            currencyId: IDS.rub,
            id: "leg-fee-charged",
            inputImpactCurrencyId: IDS.rub,
            inputImpactMinor: "200",
            kind: "fixed",
            label: "Bank fee",
            outputImpactCurrencyId: IDS.aed,
            outputImpactMinor: "947",
            routeInputImpactMinor: "200",
          },
        ],
        fromCurrencyId: IDS.rub,
        grossOutputMinor: "373676831",
        id: "leg-1",
        idx: 1,
        inputAmountMinor: "79005226",
        netOutputMinor: "373675884",
        rateDen: "100",
        rateNum: "473",
        rateSource: "market",
        toCurrencyId: IDS.aed,
      },
      {
        asOf: "2026-04-19T09:58:00.000Z",
        fees: [],
        fromCurrencyId: IDS.aed,
        grossOutputMinor: "101819387",
        id: "leg-2",
        idx: 2,
        inputAmountMinor: "373675884",
        netOutputMinor: "101819387",
        rateDen: "367",
        rateNum: "100",
        rateSource: "derived",
        toCurrencyId: IDS.usd,
      },
    ],
    lockedSide: "currency_in",
    netAmountOutMinor: "101819387",
  } as const;
}

function createQuotePreview() {
  return {
    commercialTerms: {
      agreementFeeBps: 125n,
      agreementVersionId: "agreement-version-1",
      fixedFeeAmountMinor: 1500n,
      fixedFeeCurrency: "USD",
      quoteMarkupBps: 25n,
      totalFeeBps: 150n,
    },
    dealDirection: null,
    dealForm: null,
    expiresAt: new Date("2026-04-19T10:58:00.000Z"),
    feeComponents: [],
    financialLines: [
      {
        amountMinor: 197513n,
        bucket: "fee_revenue" as const,
        currency: "RUB",
        id: "commercial:quote_markup",
        metadata: {},
        source: "manual" as const,
      },
      {
        amountMinor: 150n,
        bucket: "pass_through" as const,
        currency: "RUB",
        id: "additional-charged",
        metadata: {},
        source: "manual" as const,
      },
    ],
    fromAmountMinor: 79005226n,
    fromCurrency: "RUB",
    legs: [],
    pricingMode: "explicit_route" as const,
    pricingTrace: {},
    rateDen: 79005226n,
    rateNum: 101819387n,
    toAmountMinor: 101819387n,
    toCurrency: "USD",
  };
}

function createQuoteRecord() {
  return {
    commercialTerms: {
      agreementFeeBps: 125n,
      agreementVersionId: "agreement-version-1",
      fixedFeeAmountMinor: 1500n,
      fixedFeeCurrency: "USD",
      quoteMarkupBps: 25n,
      totalFeeBps: 150n,
    },
    createdAt: new Date("2026-04-19T09:58:00.000Z"),
    dealDirection: null,
    dealForm: null,
    dealId: IDS.deal,
    expiresAt: new Date("2026-04-19T10:58:00.000Z"),
    fromAmountMinor: 79005226n,
    fromCurrency: "RUB",
    fromCurrencyId: IDS.rub,
    id: "quote-1",
    idempotencyKey: "idem-1",
    pricingMode: "explicit_route" as const,
    pricingTrace: {},
    rateDen: 79005226n,
    rateNum: 101819387n,
    status: "active" as const,
    toAmountMinor: 101819387n,
    toCurrency: "USD",
    toCurrencyId: IDS.usd,
    usedAt: null,
    usedByRef: null,
    usedDocumentId: null,
  };
}

function createPricingContext(overrides?: Record<string, unknown>) {
  return {
    commercialDraft: {
      fixedFeeAmount: "15.00",
      fixedFeeCurrency: "USD",
      quoteMarkupBps: 25,
    },
    fundingAdjustments: [
      {
        amountMinor: "128943093",
        currencyId: IDS.rub,
        id: "adjustment-rub",
        kind: "available_balance",
        label: "AFA EXI RUB balance",
      },
      {
        amountMinor: "300000000",
        currencyId: IDS.aed,
        id: "adjustment-aed-funded",
        kind: "already_funded",
        label: "Already funded",
      },
      {
        amountMinor: "3744700",
        currencyId: IDS.aed,
        id: "adjustment-aed-reconciliation",
        kind: "reconciliation_adjustment",
        label: "Reconciliation delta",
      },
    ],
    revision: 3,
    routeAttachment: {
      attachedAt: new Date("2026-04-19T09:00:00.000Z"),
      snapshot: createRouteSnapshot(),
      templateId: IDS.route,
      templateName: "RUB via AED to USD",
    },
    ...overrides,
  };
}

function createDeal(overrides?: Record<string, unknown>) {
  return {
    agreementId: "agreement-1",
    customerId: IDS.customer,
    id: IDS.deal,
    status: "submitted",
    type: "payment",
    ...overrides,
  };
}

function createWorkflowRecord(overrides?: Record<string, unknown>) {
  return {
    intake: {
      moneyRequest: {
        sourceCurrencyId: IDS.rub,
        targetCurrencyId: IDS.usd,
      },
    },
    ...overrides,
  };
}

function createRouteListItem(input: {
  id: string;
  sourceBinding: "abstract" | "bound";
  sourceEntityId: string | null;
  updatedAt: string;
  currencyInId?: string;
  currencyOutId?: string;
}) {
  return {
    createdAt: "2026-04-19T08:00:00.000Z",
    currencyInId: input.currencyInId ?? IDS.rub,
    currencyOutId: input.currencyOutId ?? IDS.usd,
    destinationEndpoint: {
      binding: "abstract",
      displayName: "Beneficiary",
      entityId: null,
      entityKind: null,
      requisiteId: null,
      role: "destination",
    },
    hopCount: 1,
    id: input.id,
    lastCalculation: null,
    name: input.id,
    snapshotPolicy: "clone_on_attach",
    sourceEndpoint: {
      binding: input.sourceBinding,
      displayName: input.sourceBinding === "bound" ? "Acme" : "Client",
      entityId: input.sourceEntityId,
      entityKind: input.sourceBinding === "bound" ? "customer" : null,
      requisiteId: null,
      role: "source",
    },
    status: "active",
    updatedAt: input.updatedAt,
  } as const;
}

function createDeps(overrides?: {
  context?: Record<string, unknown>;
  deal?: Record<string, unknown>;
  listTemplatesResult?: ReturnType<typeof createRouteListItem>[];
  routePreview?: ReturnType<typeof createRoutePreview>;
  workflow?: Record<string, unknown>;
}) {
  const context = createPricingContext(overrides?.context);
  const deal = createDeal(overrides?.deal);
  const workflowRecord = createWorkflowRecord(overrides?.workflow);
  const routePreview = overrides?.routePreview ?? createRoutePreview();
  const quotePreview = createQuotePreview();
  const quoteRecord = createQuoteRecord();
  const listTemplatesResult =
    overrides?.listTemplatesResult ??
    [
      createRouteListItem({
        id: "route-customer",
        sourceBinding: "bound",
        sourceEntityId: IDS.customer,
        updatedAt: "2026-04-19T08:10:00.000Z",
      }),
      createRouteListItem({
        id: "route-abstract",
        sourceBinding: "abstract",
        sourceEntityId: null,
        updatedAt: "2026-04-19T08:20:00.000Z",
      }),
    ];

  const deps = {
    agreements: {
      agreements: {
        queries: {
          findById: vi.fn(async () => ({
            currentVersion: {
              feeRules: [
                {
                  currencyCode: null,
                  kind: "agent_fee",
                  value: "125",
                },
              ],
              id: "agreement-version-1",
            },
            id: "agreement-1",
          })),
        },
      },
    },
    currencies: {
      findByCode: vi.fn(async (code: string) => {
        const upper = code.toUpperCase();

        if (upper === "RUB") {
          return { code: upper, id: IDS.rub, precision: 2 };
        }
        if (upper === "AED") {
          return { code: upper, id: IDS.aed, precision: 2 };
        }
        if (upper === "USD") {
          return { code: upper, id: IDS.usd, precision: 2 };
        }

        throw new Error(`Unexpected currency code ${code}`);
      }),
      findById: vi.fn(async (id: string) => {
        if (id === IDS.rub) {
          return { code: "RUB", id, precision: 2 };
        }
        if (id === IDS.aed) {
          return { code: "AED", id, precision: 2 };
        }
        if (id === IDS.usd) {
          return { code: "USD", id, precision: 2 };
        }

        throw new Error(`Unexpected currency id ${id}`);
      }),
    },
    deals: {
      deals: {
        commands: {
          attachPricingRoute: vi.fn(),
          detachPricingRoute: vi.fn(),
          swapDealRouteTemplate: vi.fn(async () => workflowRecord),
          updatePricingContext: vi.fn(),
        },
        queries: {
          findById: vi.fn(async () => deal),
          findPricingContextByDealId: vi.fn(async () => context),
          findWorkflowById: vi.fn(async () => workflowRecord),
        },
      },
    },
    treasury: {
      paymentRoutes: {
        queries: {
          findTemplateById: vi.fn(),
          listTemplates: vi.fn(async () => ({
            data: listTemplatesResult,
            limit: 200,
            offset: 0,
            total: listTemplatesResult.length,
          })),
          previewTemplate: vi.fn(async () => routePreview),
        },
      },
      paymentSteps: {
        commands: {
          cancelDrafts: vi.fn(async () => ({ cancelledCount: 0 })),
        },
        queries: {
          list: vi.fn(async () => ({
            data: [],
            limit: 100,
            offset: 0,
            total: 0,
          })),
        },
      },
      rates: {
        queries: {
          getCrossRate: vi.fn(async (base: string, quote: string) => {
            if (base === quote) {
              return {
                base,
                quote,
                rateDen: 1n,
                rateNum: 1n,
              };
            }

            if (base === "RUB" && quote === "USD") {
              return {
                base,
                quote,
                rateDen: 78926300n,
                rateNum: 1000000n,
              };
            }

            if (base === "USD" && quote === "RUB") {
              return {
                base,
                quote,
                rateDen: 1000000n,
                rateNum: 78926300n,
              };
            }

            throw new Error(`Unexpected cross rate ${base}/${quote}`);
          }),
        },
      },
      quotes: {
        commands: {
          createQuote: vi.fn(async () => quoteRecord),
        },
        queries: {
          previewQuote: vi.fn(async () => quotePreview),
        },
      },
    },
  };

  return {
    deps,
    quotePreview,
    quoteRecord,
    routePreview,
  };
}

describe("deal pricing workflow", () => {
  it("filters route candidates to exact currency matches and ranks customer-bound routes first", async () => {
    const { deps } = createDeps({
      listTemplatesResult: [
        createRouteListItem({
          id: "route-abstract-newer",
          sourceBinding: "abstract",
          sourceEntityId: null,
          updatedAt: "2026-04-19T09:00:00.000Z",
        }),
        createRouteListItem({
          id: "route-customer-older",
          sourceBinding: "bound",
          sourceEntityId: IDS.customer,
          updatedAt: "2026-04-19T08:00:00.000Z",
        }),
        createRouteListItem({
          id: "route-other-customer",
          sourceBinding: "bound",
          sourceEntityId: IDS.otherCustomer,
          updatedAt: "2026-04-19T10:00:00.000Z",
        }),
        createRouteListItem({
          id: "route-wrong-pair",
          currencyOutId: IDS.aed,
          sourceBinding: "abstract",
          sourceEntityId: null,
          updatedAt: "2026-04-19T11:00:00.000Z",
        }),
      ],
    });
    const workflow = createDealPricingWorkflow(deps as any);

    const routes = await workflow.listRoutes({
      dealId: IDS.deal,
    });

    expect(routes.map((route) => route.id)).toEqual([
      "route-customer-older",
      "route-abstract-newer",
    ]);
  });

  it("builds explicit-route quote previews with customer and internal route fee lines", async () => {
    const { deps, routePreview } = createDeps();
    const workflow = createDealPricingWorkflow(deps as any);

    const preview = await workflow.preview({
      amountMinor: "79005226",
      amountSide: "source",
      asOf: new Date("2026-04-19T09:58:00.000Z"),
      dealId: IDS.deal,
      expectedRevision: 3,
    });

    expect(deps.treasury.paymentRoutes.queries.previewTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        asOf: new Date("2026-04-19T09:58:00.000Z"),
        draft: expect.objectContaining({
          amountInMinor: "79005226",
          lockedSide: "currency_in",
        }),
      }),
    );
    expect(deps.treasury.quotes.queries.previewQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        commercialTerms: expect.objectContaining({
          agreementFeeBps: "125",
          fixedFeeAmount: "15.00",
          fixedFeeCurrency: "USD",
          quoteMarkupBps: "25",
        }),
        fromCurrency: "RUB",
        legs: [
          expect.objectContaining({
            fromCurrency: "RUB",
            sourceKind: "market",
            toCurrency: "AED",
          }),
          expect.objectContaining({
            fromCurrency: "AED",
            sourceKind: "derived",
            toCurrency: "USD",
          }),
        ],
        manualFinancialLines: expect.arrayContaining([
          expect.objectContaining({
            amountMinor: 150n,
            bucket: "pass_through",
            currency: "RUB",
            metadata: expect.objectContaining({
              embeddedInRoute: "false",
              paymentRouteFeeId: "additional-charged",
            }),
          }),
          expect.objectContaining({
            amountMinor: 300n,
            bucket: "provider_fee_expense",
            currency: "RUB",
            metadata: expect.objectContaining({
              embeddedInRoute: "false",
              paymentRouteFeeId: "additional-internal",
            }),
          }),
          expect.objectContaining({
            amountMinor: 200n,
            bucket: "pass_through",
            currency: "RUB",
            metadata: expect.objectContaining({
              embeddedInRoute: "true",
              paymentRouteFeeId: "leg-fee-charged",
              paymentRouteFeeLocation: "leg",
            }),
          }),
        ]),
        mode: "explicit_route",
        pricingTrace: expect.objectContaining({
          metadata: expect.objectContaining({
            dealPricingRevision: "3",
            routeTemplateId: IDS.route,
            routeTemplateName: "RUB via AED to USD",
          }),
        }),
        toCurrency: "USD",
      }),
    );
    expect(preview).toMatchObject({
      benchmarks: {
        client: {
          baseCurrency: "RUB",
          quoteCurrency: "USD",
        },
        market: {
          baseCurrency: "RUB",
          quoteCurrency: "USD",
          rateDen: "78926300",
          rateNum: "1000000",
        },
        pricingBase: "route_benchmark",
        routeBase: {
          baseCurrency: "RUB",
          quoteCurrency: "USD",
        },
      },
      formulaTrace: {
        sections: expect.arrayContaining([
          expect.objectContaining({
            kind: "client_pricing",
          }),
          expect.objectContaining({
            kind: "route_execution",
          }),
          expect.objectContaining({
            kind: "funding",
          }),
        ]),
      },
      pricingMode: "explicit_route",
      profitability: expect.objectContaining({
        commercialRevenueMinor: "197513",
        passThroughMinor: "150",
      }),
      routePreview,
    });
    expect(preview.fundingSummary.positions).toEqual([
      {
        adjustmentTotalMinor: "303744700",
        currencyCode: "AED",
        currencyId: IDS.aed,
        netFundingNeedMinor: "69932131",
        requiredMinor: "373676831",
      },
      {
        adjustmentTotalMinor: "128943093",
        currencyCode: "RUB",
        currencyId: IDS.rub,
        netFundingNeedMinor: "-49937867",
        requiredMinor: "79005226",
      },
      {
        adjustmentTotalMinor: "0",
        currencyCode: "USD",
        currencyId: IDS.usd,
        netFundingNeedMinor: "101819387",
        requiredMinor: "101819387",
      },
    ]);
  });

  it("falls back to auto_cross when no route is attached", async () => {
    const { deps, quotePreview } = createDeps({
      context: {
        routeAttachment: null,
      },
    });
    const workflow = createDealPricingWorkflow(deps as any);

    const preview = await workflow.preview({
      amountMinor: "100000",
      amountSide: "source",
      asOf: new Date("2026-04-19T10:00:00.000Z"),
      dealId: IDS.deal,
      expectedRevision: 3,
    });

    expect(deps.treasury.paymentRoutes.queries.previewTemplate).not.toHaveBeenCalled();
    expect(deps.treasury.quotes.queries.previewQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        commercialTerms: expect.objectContaining({
          agreementFeeBps: "125",
          fixedFeeAmount: "15.00",
          fixedFeeCurrency: "USD",
          quoteMarkupBps: "25",
        }),
        fromAmountMinor: 100000n,
        fromCurrency: "RUB",
        mode: "auto_cross",
        pricingTrace: expect.objectContaining({
          metadata: expect.objectContaining({
            pricingFallback: "auto_cross",
          }),
        }),
        toCurrency: "USD",
      }),
    );
    expect(preview).toMatchObject({
      benchmarks: {
        market: {
          rateDen: "78926300",
          rateNum: "1000000",
        },
        pricingBase: "market_benchmark",
        routeBase: null,
      },
      formulaTrace: {
        sections: expect.arrayContaining([
          expect.objectContaining({
            kind: "route_execution",
          }),
        ]),
      },
      fundingSummary: {
        positions: [
          {
            adjustmentTotalMinor: "128943093",
            currencyCode: "RUB",
            currencyId: IDS.rub,
            netFundingNeedMinor: "-49937867",
            requiredMinor: "79005226",
          },
          {
            adjustmentTotalMinor: "0",
            currencyCode: "USD",
            currencyId: IDS.usd,
            netFundingNeedMinor: "101819387",
            requiredMinor: "101819387",
          },
        ],
      },
      pricingMode: "auto_cross",
      profitability: expect.objectContaining({
        commercialRevenueMinor: "197513",
      }),
      quotePreview,
      routePreview: null,
    });
  });

  it("rejects stale deal pricing revisions before building a preview", async () => {
    const { deps } = createDeps();
    const workflow = createDealPricingWorkflow(deps as any);

    await expect(
      workflow.preview({
        amountMinor: "79005226",
        amountSide: "source",
        asOf: new Date("2026-04-19T09:58:00.000Z"),
        dealId: IDS.deal,
        expectedRevision: 2,
      }),
    ).rejects.toBeInstanceOf(DealPricingContextRevisionConflictError);

    expect(deps.treasury.paymentRoutes.queries.previewTemplate).not.toHaveBeenCalled();
    expect(deps.treasury.quotes.queries.previewQuote).not.toHaveBeenCalled();
  });

  it("stores CRM pricing snapshot inside quote pricingTrace metadata on create", async () => {
    const { deps } = createDeps();
    const workflow = createDealPricingWorkflow(deps as any);

    await workflow.createQuote({
      amountMinor: "79005226",
      amountSide: "source",
      asOf: new Date("2026-04-19T09:58:00.000Z"),
      dealId: IDS.deal,
      expectedRevision: 3,
      idempotencyKey: "idem-1",
    });

    expect(deps.treasury.quotes.commands.createQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        pricingTrace: expect.objectContaining({
          metadata: expect.objectContaining({
            crmPricingSnapshot: expect.objectContaining({
              benchmarks: expect.objectContaining({
                pricingBase: "route_benchmark",
              }),
              formulaTrace: expect.objectContaining({
                sections: expect.any(Array),
              }),
            }),
          }),
        }),
      }),
    );
  });

  describe("initializeDefaultRoute", () => {
    it("returns context unchanged when route already attached", async () => {
      const { deps } = createDeps();
      const workflow = createDealPricingWorkflow(deps as any);

      const result = await workflow.initializeDefaultRoute({
        dealId: IDS.deal,
      });

      expect(result.routeAttachment).not.toBeNull();
      expect(deps.treasury.paymentRoutes.queries.findTemplateById).not.toHaveBeenCalled();
      expect(deps.deals.deals.commands.attachPricingRoute).not.toHaveBeenCalled();
    });

    it("returns context unchanged when no route candidates exist", async () => {
      const contextWithoutAttachment = createPricingContext({
        routeAttachment: null,
      });
      const { deps } = createDeps({
        context: contextWithoutAttachment,
        listTemplatesResult: [],
      });
      // Re-bind the no-attachment context
      deps.deals.deals.queries.findPricingContextByDealId = vi.fn(
        async () => contextWithoutAttachment,
      );
      const workflow = createDealPricingWorkflow(deps as any);

      const result = await workflow.initializeDefaultRoute({
        dealId: IDS.deal,
      });

      expect(result.routeAttachment).toBeNull();
      expect(deps.deals.deals.commands.attachPricingRoute).not.toHaveBeenCalled();
    });

    it("attaches the top candidate when no route is attached yet", async () => {
      const contextWithoutAttachment = createPricingContext({
        routeAttachment: null,
      });
      const attachedContext = createPricingContext({ revision: 4 });
      const { deps } = createDeps({
        context: contextWithoutAttachment,
        listTemplatesResult: [
          createRouteListItem({
            id: "00000000-0000-4000-8000-000000000888",
            sourceBinding: "bound",
            sourceEntityId: IDS.customer,
            updatedAt: "2026-04-19T08:10:00.000Z",
          }),
        ],
      });
      deps.deals.deals.queries.findPricingContextByDealId = vi.fn(
        async () => contextWithoutAttachment,
      );
      deps.treasury.paymentRoutes.queries.findTemplateById = vi.fn(
        async () => ({
          draft: createRouteSnapshot(),
          id: "00000000-0000-4000-8000-000000000888",
          name: "Auto",
          status: "active",
        }),
      );
      deps.deals.deals.commands.attachPricingRoute = vi.fn(
        async () => attachedContext,
      );
      const workflow = createDealPricingWorkflow(deps as any);

      const result = await workflow.initializeDefaultRoute({
        dealId: IDS.deal,
      });

      expect(deps.deals.deals.commands.attachPricingRoute).toHaveBeenCalledTimes(1);
      expect(result.revision).toBe(4);
    });

    it("retries on revision conflict and returns the now-attached context", async () => {
      const contextWithoutAttachment = createPricingContext({
        routeAttachment: null,
      });
      const attachedContext = createPricingContext({ revision: 5 });
      let findContextCallCount = 0;
      const { deps } = createDeps({
        listTemplatesResult: [
          createRouteListItem({
            id: "00000000-0000-4000-8000-000000000777",
            sourceBinding: "bound",
            sourceEntityId: IDS.customer,
            updatedAt: "2026-04-19T08:10:00.000Z",
          }),
        ],
      });
      // First call: no attachment (we try and lose the race).
      // Second call: attachment is present (winner already attached).
      deps.deals.deals.queries.findPricingContextByDealId = vi.fn(async () => {
        findContextCallCount += 1;
        return findContextCallCount === 1
          ? contextWithoutAttachment
          : attachedContext;
      });
      deps.treasury.paymentRoutes.queries.findTemplateById = vi.fn(
        async () => ({
          draft: createRouteSnapshot(),
          id: "00000000-0000-4000-8000-000000000777",
          name: "Auto",
          status: "active",
        }),
      );
      deps.deals.deals.commands.attachPricingRoute = vi.fn(async () => {
        throw new DealPricingContextRevisionConflictError(IDS.deal, 3);
      });
      const workflow = createDealPricingWorkflow(deps as any);

      const result = await workflow.initializeDefaultRoute({
        dealId: IDS.deal,
      });

      expect(deps.deals.deals.commands.attachPricingRoute).toHaveBeenCalledTimes(1);
      expect(result.routeAttachment).not.toBeNull();
      expect(result.revision).toBe(5);
    });
  });

  describe("swapRouteTemplate", () => {
    function setupSwapDeps(stepsData: Array<{ id: string; state: string }> = []) {
      const { deps } = createDeps();
      const swapTemplateId = "00000000-0000-4000-8000-000000000444";
      deps.treasury.paymentRoutes.queries.findTemplateById = vi.fn(
        async () => ({
          draft: createRouteSnapshot(),
          id: swapTemplateId,
          name: "Replacement",
          status: "active",
        }),
      );
      deps.treasury.paymentSteps.queries.list = vi.fn(async () => ({
        data: stepsData,
        limit: 100,
        offset: 0,
        total: stepsData.length,
      }));
      return { deps, swapTemplateId };
    }

    it("cancels drafts and calls domain swap on happy path", async () => {
      const { deps, swapTemplateId } = setupSwapDeps([
        { id: "step-1", state: "draft" },
      ]);
      const workflow = createDealPricingWorkflow(deps as any);

      await workflow.swapRouteTemplate({
        actorUserId: "user-1",
        dealId: IDS.deal,
        memo: "test",
        newRouteTemplateId: swapTemplateId,
        reasonCode: "market_moved",
      });

      expect(deps.treasury.paymentSteps.commands.cancelDrafts).toHaveBeenCalledWith({
        actorUserId: "user-1",
        dealId: IDS.deal,
      });
      expect(deps.deals.deals.commands.swapDealRouteTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: "user-1",
          dealId: IDS.deal,
          newRouteTemplateId: swapTemplateId,
          reasonCode: "market_moved",
        }),
      );
    });

    it("rejects when a non-draft step is in execution and does NOT cancel drafts", async () => {
      const { deps, swapTemplateId } = setupSwapDeps([
        { id: "step-1", state: "draft" },
        { id: "step-2", state: "processing" },
      ]);
      const workflow = createDealPricingWorkflow(deps as any);

      await expect(
        workflow.swapRouteTemplate({
          actorUserId: "user-1",
          dealId: IDS.deal,
          newRouteTemplateId: swapTemplateId,
          reasonCode: "market_moved",
        }),
      ).rejects.toThrow(/payment steps are already in execution/);

      expect(deps.treasury.paymentSteps.commands.cancelDrafts).not.toHaveBeenCalled();
      expect(deps.deals.deals.commands.swapDealRouteTemplate).not.toHaveBeenCalled();
    });

    it("rejects when an executing step is beyond the first page", async () => {
      const { deps, swapTemplateId } = setupSwapDeps();
      deps.treasury.paymentSteps.queries.list = vi.fn(async ({ offset }) => ({
        data:
          offset === 0
            ? Array.from({ length: 100 }, (_, index) => ({
                id: `draft-${index}`,
                state: "draft",
              }))
            : [{ id: "step-101", state: "processing" }],
        limit: 100,
        offset,
        total: 101,
      }));
      const workflow = createDealPricingWorkflow(deps as any);

      await expect(
        workflow.swapRouteTemplate({
          actorUserId: "user-1",
          dealId: IDS.deal,
          newRouteTemplateId: swapTemplateId,
          reasonCode: "market_moved",
        }),
      ).rejects.toThrow(/payment steps are already in execution/);

      expect(deps.treasury.paymentSteps.queries.list).toHaveBeenCalledWith({
        dealId: IDS.deal,
        limit: 100,
        offset: 100,
        purpose: "deal_leg",
      });
      expect(deps.treasury.paymentSteps.commands.cancelDrafts).not.toHaveBeenCalled();
      expect(deps.deals.deals.commands.swapDealRouteTemplate).not.toHaveBeenCalled();
    });

    it("rejects bad route template id BEFORE cancelling drafts", async () => {
      const { deps } = setupSwapDeps([{ id: "step-1", state: "draft" }]);
      deps.treasury.paymentRoutes.queries.findTemplateById = vi.fn(
        async () => null,
      );
      const workflow = createDealPricingWorkflow(deps as any);

      await expect(
        workflow.swapRouteTemplate({
          actorUserId: "user-1",
          dealId: IDS.deal,
          newRouteTemplateId: "00000000-0000-4000-8000-000000009999",
          reasonCode: "market_moved",
        }),
      ).rejects.toThrow(/Payment route template not found/);

      expect(deps.treasury.paymentSteps.commands.cancelDrafts).not.toHaveBeenCalled();
      expect(deps.deals.deals.commands.swapDealRouteTemplate).not.toHaveBeenCalled();
    });

    it("rejects route template with mismatching currency BEFORE cancelling drafts", async () => {
      const { deps } = setupSwapDeps([{ id: "step-1", state: "draft" }]);
      const swapTemplateId = "00000000-0000-4000-8000-000000000555";
      deps.treasury.paymentRoutes.queries.findTemplateById = vi.fn(
        async () => ({
          draft: {
            ...createRouteSnapshot(),
            currencyInId: IDS.aed,
            currencyOutId: IDS.usd,
          },
          id: swapTemplateId,
          name: "Wrong Pair",
          status: "active",
        }),
      );
      const workflow = createDealPricingWorkflow(deps as any);

      await expect(
        workflow.swapRouteTemplate({
          actorUserId: "user-1",
          dealId: IDS.deal,
          newRouteTemplateId: swapTemplateId,
          reasonCode: "market_moved",
        }),
      ).rejects.toThrow(/does not match deal currency pair/);

      expect(deps.treasury.paymentSteps.commands.cancelDrafts).not.toHaveBeenCalled();
      expect(deps.deals.deals.commands.swapDealRouteTemplate).not.toHaveBeenCalled();
    });
  });
});
