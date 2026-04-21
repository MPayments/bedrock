import { describe, expect, it } from "vitest";

import { createModuleRuntime } from "@bedrock/shared/core";

import { createMockCurrenciesService, currencyIdForCode } from "./helpers";
import { createPaymentRoutesService } from "../src/payment-routes/application";
import {
  PaymentRouteCalculationSchema,
  PaymentRouteCalculationFeeSchema,
  type PaymentRouteCalculation,
} from "../src/payment-routes/application/contracts/dto";
import {
  derivePaymentRouteLegSemantics,
  formatPaymentRouteLegSemantics,
  getPaymentRouteParticipantOperationalCurrency,
  PaymentRouteDraftSchema,
  type PaymentRouteDraft,
} from "../src/payment-routes/application/contracts/zod";
import type {
  PaymentRouteTemplateRecord,
  PaymentRouteTemplatesRepository,
} from "../src/payment-routes/application/ports/payment-routes.repository";

const USD = currencyIdForCode("USD");
const AED = currencyIdForCode("AED");
const USDT = currencyIdForCode("USDT");

function createDraft(input: Partial<PaymentRouteDraft> = {}): PaymentRouteDraft {
  return {
    additionalFees: [],
    amountInMinor: "10000",
    amountOutMinor: "10000",
    currencyInId: USD,
    currencyOutId: USD,
    legs: [
      {
        fees: [],
        fromCurrencyId: USD,
        id: "leg-1",
        toCurrencyId: USD,
      },
    ],
    lockedSide: "currency_in",
    participants: [
      {
        binding: "bound",
        displayName: "Acme Customer",
        entityId: "00000000-0000-4000-8000-000000000001",
        entityKind: "customer",
        nodeId: "node-customer",
        requisiteId: null,
        role: "source",
      },
      {
        binding: "bound",
        displayName: "Bedrock Treasury",
        entityId: "00000000-0000-4000-8000-000000000002",
        entityKind: "organization",
        nodeId: "node-org",
        requisiteId: null,
        role: "destination",
      },
    ],
    ...input,
  };
}

class InMemoryPaymentRouteTemplatesRepository
  implements PaymentRouteTemplatesRepository
{
  private readonly rows = new Map<string, PaymentRouteTemplateRecord>();

  async insertTemplate(
    input: PaymentRouteTemplateRecord,
  ): Promise<PaymentRouteTemplateRecord> {
    const snapshot = structuredClone(input);
    this.rows.set(snapshot.id, snapshot);
    return structuredClone(snapshot);
  }

  async updateTemplate(
    id: string,
    input: Partial<PaymentRouteTemplateRecord>,
  ): Promise<PaymentRouteTemplateRecord | null> {
    const existing = this.rows.get(id);
    if (!existing) {
      return null;
    }

    const next = structuredClone({
      ...existing,
      ...input,
    });
    this.rows.set(id, next);
    return structuredClone(next);
  }

  async findTemplateById(id: string): Promise<PaymentRouteTemplateRecord | null> {
    const existing = this.rows.get(id);
    return existing ? structuredClone(existing) : null;
  }

  async listTemplates() {
    const rows = Array.from(this.rows.values()).map((row) => structuredClone(row));
    return {
      rows,
      total: rows.length,
    };
  }
}

function createService() {
  const repository = new InMemoryPaymentRouteTemplatesRepository();
  const now = new Date("2026-04-16T08:00:00.000Z");
  const service = createPaymentRoutesService({
    currencies: createMockCurrenciesService([
      { code: "USD", id: USD, name: "US Dollar", precision: 2, symbol: "$" },
      { code: "AED", id: AED, name: "UAE Dirham", precision: 2, symbol: "AED" },
      { code: "USDT", id: USDT, name: "Tether", precision: 6, symbol: "USDT" },
      { code: "EUR", id: currencyIdForCode("EUR"), name: "Euro", precision: 2, symbol: "EUR" },
    ]),
    repository,
    runtime: createModuleRuntime({
      generateUuid: () => crypto.randomUUID(),
      now: () => now,
      service: "treasury.payment-routes.test",
    }),
    getCrossRate: async (base, quote) => {
      const pair = `${base}/${quote}`;

      if (pair === "USD/AED" || pair === "USDT/AED") {
        return {
          base,
          quote,
          rateDen: 100n,
          rateNum: 367n,
        };
      }

      if (pair === "AED/USD") {
        return {
          base,
          quote,
          rateDen: 367n,
          rateNum: 100n,
        };
      }

      if (pair === "AED/USDT") {
        return {
          base,
          quote,
          rateDen: 367n,
          rateNum: 100n,
        };
      }

      if (pair === "USD/USDT" || pair === "USDT/USD") {
        return {
          base,
          quote,
          rateDen: 1n,
          rateNum: 1n,
        };
      }

      if (pair === "USD/EUR") {
        return {
          base,
          quote,
          rateDen: 1n,
          rateNum: 2n,
        };
      }

      if (pair === "EUR/USD") {
        return {
          base,
          quote,
          rateDen: 2n,
          rateNum: 1n,
        };
      }

      if (base === quote) {
        return {
          base,
          quote,
          rateDen: 1n,
          rateNum: 1n,
        };
      }

      throw new Error(`Unhandled test pair ${pair}`);
    },
  });

  return {
    now,
    repository,
    service,
  };
}

function expectCalculationTotal(
  calculation: PaymentRouteCalculation,
  currencyId: string,
  amountMinor: string,
) {
  expect(calculation.feeTotals).toEqual([
    {
      amountMinor,
      currencyId,
    },
  ]);
}

describe("payment routes", () => {
  it("previews fixed-only fees", async () => {
    const { service } = createService();
    const draft = createDraft({
      additionalFees: [
        {
          amountMinor: "50",
          chargeToCustomer: true,
          currencyId: USD,
          id: "fee-extra",
          kind: "fixed",
          label: "Bank",
        },
      ],
      legs: [
        {
          fees: [
            {
              amountMinor: "100",
              chargeToCustomer: true,
              currencyId: USD,
              id: "fee-leg",
              kind: "fixed",
              label: "Hop",
            },
          ],
          fromCurrencyId: USD,
          id: "leg-1",
          toCurrencyId: USD,
        },
      ],
    });

    const calculation = await service.queries.previewTemplate({ draft });

    expect(calculation.amountOutMinor).toBe("9900");
    expectCalculationTotal(calculation, USD, "150");
  });

  it("previews percent-only fees", async () => {
    const { service } = createService();
    const draft = createDraft({
      additionalFees: [
        {
          chargeToCustomer: true,
          id: "fee-extra",
          kind: "gross_percent",
          label: "Bank",
          percentage: "5",
        },
      ],
      legs: [
        {
          fees: [
            {
              chargeToCustomer: true,
              id: "fee-leg",
              kind: "gross_percent",
              label: "Hop",
              percentage: "10",
            },
          ],
          fromCurrencyId: USD,
          id: "leg-1",
          toCurrencyId: USD,
        },
      ],
    });

    const calculation = await service.queries.previewTemplate({ draft });

    expect(calculation.amountOutMinor).toBe("9000");
    expectCalculationTotal(calculation, USD, "1500");
  });

  it("treats additional fees as separate costs without reducing payout", async () => {
    const { service } = createService();
    const draft = createDraft({
      additionalFees: [
        {
          amountMinor: "20000",
          chargeToCustomer: true,
          currencyId: USD,
          id: "fee-extra",
          kind: "fixed",
          label: "Bank",
        },
      ],
      currencyOutId: currencyIdForCode("EUR"),
      legs: [
        {
          fees: [],
          fromCurrencyId: USD,
          id: "leg-1",
          toCurrencyId: currencyIdForCode("EUR"),
        },
      ],
    });

    const calculation = await service.queries.previewTemplate({ draft });

    expect(calculation.amountOutMinor).toBe("20000");
    expect(calculation.netAmountOutMinor).toBe("20000");
    expectCalculationTotal(calculation, USD, "20000");
  });

  it("keeps internal leg fees out of the customer payout while increasing cost price", async () => {
    const { service } = createService();
    const draft = createDraft({
      legs: [
        {
          fees: [
            {
              amountMinor: "100",
              chargeToCustomer: false,
              currencyId: USD,
              id: "fee-leg-internal",
              kind: "fixed",
              label: "Internal bank fee",
            },
          ],
          fromCurrencyId: USD,
          id: "leg-1",
          toCurrencyId: USD,
        },
      ],
    });

    const calculation = await service.queries.previewTemplate({ draft });

    expect(calculation.amountOutMinor).toBe("10000");
    expect(calculation.clientTotalInMinor).toBe("10000");
    expect(calculation.costPriceInMinor).toBe("10100");
    expect(calculation.internalFeeTotals).toEqual([
      {
        amountMinor: "100",
        currencyId: USD,
      },
    ]);
  });

  it("keeps internal additional fees out of the client total while increasing cost price", async () => {
    const { service } = createService();
    const draft = createDraft({
      additionalFees: [
        {
          amountMinor: "125",
          chargeToCustomer: false,
          currencyId: USD,
          id: "fee-extra-internal",
          kind: "fixed",
          label: "Internal uplift",
        },
      ],
    });

    const calculation = await service.queries.previewTemplate({ draft });

    expect(calculation.amountOutMinor).toBe("10000");
    expect(calculation.clientTotalInMinor).toBe("10000");
    expect(calculation.costPriceInMinor).toBe("10125");
    expect(calculation.internalFeeTotals).toEqual([
      {
        amountMinor: "125",
        currencyId: USD,
      },
    ]);
  });

  it("separates clean, client, and cost totals for mixed charged and internal fees", async () => {
    const { service } = createService();
    const draft = createDraft({
      additionalFees: [
        {
          amountMinor: "25",
          chargeToCustomer: true,
          currencyId: USD,
          id: "fee-extra-charged",
          kind: "fixed",
          label: "Client surcharge",
        },
        {
          amountMinor: "10",
          chargeToCustomer: false,
          currencyId: USD,
          id: "fee-extra-internal",
          kind: "fixed",
          label: "Internal surcharge",
        },
      ],
      legs: [
        {
          fees: [
            {
              amountMinor: "100",
              chargeToCustomer: true,
              currencyId: USD,
              id: "fee-leg-charged",
              kind: "fixed",
              label: "Charged hop fee",
            },
            {
              amountMinor: "50",
              chargeToCustomer: false,
              currencyId: USD,
              id: "fee-leg-internal",
              kind: "fixed",
              label: "Internal hop fee",
            },
          ],
          fromCurrencyId: USD,
          id: "leg-1",
          toCurrencyId: USD,
        },
      ],
    });

    const calculation = await service.queries.previewTemplate({ draft });

    expect(calculation.cleanAmountOutMinor).toBe("10000");
    expect(calculation.amountOutMinor).toBe("9900");
    expect(calculation.clientTotalInMinor).toBe("10025");
    expect(calculation.costPriceInMinor).toBe("10185");
    expect(calculation.chargedFeeTotals).toEqual([
      {
        amountMinor: "125",
        currencyId: USD,
      },
    ]);
    expect(calculation.internalFeeTotals).toEqual([
      {
        amountMinor: "60",
        currencyId: USD,
      },
    ]);
    expect(calculation.feeTotals).toEqual([
      {
        amountMinor: "185",
        currencyId: USD,
      },
    ]);
  });

  it("accepts computed amount fields for percentage fees in calculations", () => {
    expect(() =>
      PaymentRouteCalculationFeeSchema.parse({
        amountMinor: "1000",
        chargeToCustomer: true,
        currencyId: USD,
        id: "fee-leg",
        inputImpactCurrencyId: USD,
        inputImpactMinor: "1000",
        kind: "gross_percent",
        label: "Hop",
        outputImpactCurrencyId: USD,
        outputImpactMinor: "1000",
        percentage: "10",
        routeInputImpactMinor: "1000",
      }),
    ).not.toThrow();
  });

  it("rejects calculation fees without input impact fields", () => {
    expect(() =>
      PaymentRouteCalculationFeeSchema.parse({
        amountMinor: "1000",
        currencyId: USD,
        id: "fee-legacy",
        kind: "fixed",
        label: "Legacy",
        outputImpactCurrencyId: USD,
        outputImpactMinor: "1000",
      }),
    ).toThrow();
  });

  it("rejects route drafts that still include leg kind", () => {
    expect(() =>
      PaymentRouteDraftSchema.parse({
        ...createDraft(),
        legs: [
          {
            ...createDraft().legs[0],
            kind: "transfer",
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects calculations that still include leg kind", () => {
    expect(() =>
      PaymentRouteCalculationSchema.parse({
        additionalFees: [],
        amountInMinor: "10000",
        amountOutMinor: "10000",
        chargedFeeTotals: [],
        cleanAmountOutMinor: "10000",
        clientTotalInMinor: "10000",
        computedAt: "2026-04-16T08:00:00.000Z",
        costPriceInMinor: "10000",
        currencyInId: USD,
        currencyOutId: USD,
        feeTotals: [],
        grossAmountOutMinor: "10000",
        internalFeeTotals: [],
        legs: [
          {
            asOf: "2026-04-16T08:00:00.000Z",
            fees: [],
            fromCurrencyId: USD,
            grossOutputMinor: "10000",
            id: "leg-1",
            idx: 1,
            inputAmountMinor: "10000",
            kind: "transfer",
            netOutputMinor: "10000",
            rateDen: "1",
            rateNum: "1",
            rateSource: "identity",
            toCurrencyId: USD,
          },
        ],
        lockedSide: "currency_in",
        netAmountOutMinor: "10000",
      }),
    ).toThrow();
  });

  it("previews mixed-currency multi-hop routes with treasury rates", async () => {
    const { service } = createService();
    const draft = createDraft({
      currencyInId: USDT,
      currencyOutId: USD,
      legs: [
        {
          fees: [],
          fromCurrencyId: USDT,
          id: "leg-1",
          toCurrencyId: AED,
        },
        {
          fees: [
            {
              chargeToCustomer: true,
              id: "fee-leg",
              kind: "gross_percent",
              label: "FX spread",
              percentage: "10",
            },
          ],
          fromCurrencyId: AED,
          id: "leg-2",
          toCurrencyId: USD,
        },
      ],
      participants: [
        {
          binding: "bound",
          displayName: "Acme Customer",
          entityId: "00000000-0000-4000-8000-000000000001",
          entityKind: "customer",
          nodeId: "node-customer",
          requisiteId: null,
          role: "source",
        },
        {
          binding: "bound",
          displayName: "Dubai Bank",
          entityId: "00000000-0000-4000-8000-000000000002",
          entityKind: "organization",
          nodeId: "node-dubai",
          requisiteId: null,
          role: "hop",
        },
        {
          binding: "bound",
          displayName: "USA Bank",
          entityId: "00000000-0000-4000-8000-000000000003",
          entityKind: "organization",
          nodeId: "node-usa",
          requisiteId: null,
          role: "destination",
        },
      ],
    });

    const calculation = await service.queries.previewTemplate({ draft });

    expect(calculation.amountOutMinor).toBe("9000");
    expectCalculationTotal(calculation, AED, "3670");
  });

  it("recomputes the opposite side when currencyOut is locked", async () => {
    const { service } = createService();
    const draft = createDraft({
      amountInMinor: "1",
      amountOutMinor: "9000",
      lockedSide: "currency_out",
      legs: [
        {
          fees: [
            {
              chargeToCustomer: true,
              id: "fee-leg",
              kind: "gross_percent",
              label: "Hop",
              percentage: "10",
            },
          ],
          fromCurrencyId: USD,
          id: "leg-1",
          toCurrencyId: USD,
        },
      ],
    });

    const calculation = await service.queries.previewTemplate({ draft });

    expect(calculation.amountInMinor).toBe("10000");
    expect(calculation.amountOutMinor).toBe("9000");
  });

  it("keeps increasing the input in currencyOut mode until fixed fees are coverable", async () => {
    const { service } = createService();
    const draft = createDraft({
      amountInMinor: "1",
      amountOutMinor: "9000",
      lockedSide: "currency_out",
      legs: [
        {
          fees: [
            {
              amountMinor: "100",
              chargeToCustomer: true,
              currencyId: USD,
              id: "fee-leg",
              kind: "fixed",
              label: "Hop",
            },
          ],
          fromCurrencyId: USD,
          id: "leg-1",
          toCurrencyId: USD,
        },
      ],
    });

    const calculation = await service.queries.previewTemplate({ draft });

    expect(calculation.amountInMinor).toBe("9100");
    expect(calculation.amountOutMinor).toBe("9000");
  });

  it("ignores internal leg fees when solving currencyOut targets", async () => {
    const { service } = createService();
    const draft = createDraft({
      amountInMinor: "1",
      amountOutMinor: "9000",
      lockedSide: "currency_out",
      legs: [
        {
          fees: [
            {
              amountMinor: "100",
              chargeToCustomer: false,
              currencyId: USD,
              id: "fee-leg-internal",
              kind: "fixed",
              label: "Internal hop fee",
            },
          ],
          fromCurrencyId: USD,
          id: "leg-1",
          toCurrencyId: USD,
        },
      ],
    });

    const calculation = await service.queries.previewTemplate({ draft });

    expect(calculation.amountInMinor).toBe("9000");
    expect(calculation.amountOutMinor).toBe("9000");
    expect(calculation.costPriceInMinor).toBe("9100");
  });

  it("reports the actual payout amount when locked output rounds up", async () => {
    const { service } = createService();
    const draft = createDraft({
      amountInMinor: "1",
      amountOutMinor: "1",
      currencyOutId: AED,
      lockedSide: "currency_out",
      legs: [
        {
          fees: [],
          fromCurrencyId: USD,
          id: "leg-1",
          toCurrencyId: AED,
        },
      ],
    });

    const calculation = await service.queries.previewTemplate({ draft });

    expect(calculation.amountInMinor).toBe("1");
    expect(calculation.amountOutMinor).toBe("3");
    expect(calculation.netAmountOutMinor).toBe("3");
  });

  it("previews routes with abstract source and destination endpoints", async () => {
    const { service } = createService();
    const draft = createDraft({
      participants: [
        {
          binding: "abstract",
          displayName: "Любой клиент",
          entityId: null,
          entityKind: null,
          nodeId: "node-source",
          requisiteId: null,
          role: "source",
        },
        {
          binding: "abstract",
          displayName: "Любой бенефициар",
          entityId: null,
          entityKind: null,
          nodeId: "node-destination",
          requisiteId: null,
          role: "destination",
        },
      ],
    });

    const calculation = await service.queries.previewTemplate({ draft });

    expect(calculation.amountOutMinor).toBe("10000");
    expect(calculation.netAmountOutMinor).toBe("10000");
  });

  it("normalizes legacy concrete templates on read", async () => {
    const { now, repository, service } = createService();

    await repository.insertTemplate({
      createdAt: now,
      draft: {
        ...createDraft(),
        legs: [
          {
            ...createDraft().legs[0],
            fees: [
              {
                amountMinor: "100",
                currencyId: USD,
                id: "fee-leg-legacy",
                kind: "fixed",
                label: "Legacy bank fee",
              },
            ],
          },
        ],
        participants: [
          {
            displayName: "Legacy Customer",
            entityId: "00000000-0000-4000-8000-000000000001",
            kind: "customer",
            nodeId: "node-legacy-source",
          },
          {
            displayName: "Legacy Treasury",
            entityId: "00000000-0000-4000-8000-000000000002",
            kind: "organization",
            nodeId: "node-legacy-destination",
          },
        ],
      } as PaymentRouteDraft,
      id: "00000000-0000-4000-8000-000000000099",
      lastCalculation: {
        additionalFees: [],
        amountInMinor: "10000",
        amountOutMinor: "9900",
        computedAt: now.toISOString(),
        currencyInId: USD,
        currencyOutId: USD,
        feeTotals: [],
        grossAmountOutMinor: "10000",
        legs: [],
        lockedSide: "currency_in",
        netAmountOutMinor: "9900",
      } as PaymentRouteCalculation,
      name: "Legacy route",
      snapshotPolicy: "clone_on_attach",
      status: "active",
      updatedAt: now,
      visual: {
        nodePositions: {},
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    } as any);

    const template = await service.queries.findTemplateById(
      "00000000-0000-4000-8000-000000000099",
    );
    const list = await service.queries.listTemplates({
      limit: 20,
      offset: 0,
    });

    expect(template.draft.participants[0]).toMatchObject({
      binding: "bound",
      entityKind: "customer",
      role: "source",
    });
    expect(template.draft.participants[1]).toMatchObject({
      binding: "bound",
      entityKind: "organization",
      role: "destination",
    });
    expect(template.draft.legs[0]?.fees[0]?.chargeToCustomer).toBe(false);
    expect(template.lastCalculation).toBeNull();
    expect(list.data[0]?.sourceEndpoint).toMatchObject({
      binding: "bound",
      entityKind: "customer",
      role: "source",
    });
    expect(list.data[0]?.destinationEndpoint).toMatchObject({
      binding: "bound",
      entityKind: "organization",
      role: "destination",
      requisiteId: null,
    });
    expect(list.data[0]?.lastCalculation).toBeNull();
  });

  it("normalizes missing participant requisite ids to null", () => {
    const draft = PaymentRouteDraftSchema.parse({
      ...createDraft(),
      participants: [
        {
          binding: "bound",
          displayName: "Acme Customer",
          entityId: "00000000-0000-4000-8000-000000000001",
          entityKind: "customer",
          nodeId: "node-customer",
          role: "source",
        },
        {
          binding: "bound",
          displayName: "Bedrock Treasury",
          entityId: "00000000-0000-4000-8000-000000000002",
          entityKind: "organization",
          nodeId: "node-org",
          role: "destination",
        },
      ],
    });

    expect(draft.participants[0]?.requisiteId).toBeNull();
    expect(draft.participants[1]?.requisiteId).toBeNull();
  });

  it("defaults missing chargeToCustomer flags to false for legacy fee drafts", () => {
    const draft = PaymentRouteDraftSchema.parse({
      ...createDraft(),
      additionalFees: [
        {
          amountMinor: "25",
          currencyId: USD,
          id: "fee-extra-legacy",
          kind: "fixed",
          label: "Legacy additional fee",
        },
      ],
      legs: [
        {
          ...createDraft().legs[0],
          fees: [
            {
              amountMinor: "100",
              currencyId: USD,
              id: "fee-leg-legacy",
              kind: "fixed",
              label: "Legacy leg fee",
            },
          ],
        },
      ],
    });

    expect(draft.additionalFees[0]?.chargeToCustomer).toBe(false);
    expect(draft.legs[0]?.fees[0]?.chargeToCustomer).toBe(false);
  });

  it("derives stable route semantics labels from participants and currencies", () => {
    expect(
      derivePaymentRouteLegSemantics({
        draft: createDraft(),
        legIndex: 0,
      }),
    ).toEqual(["collection", "payout"]);
    expect(
      formatPaymentRouteLegSemantics(
        derivePaymentRouteLegSemantics({
          draft: createDraft({
            currencyOutId: AED,
            legs: [
              {
                fees: [],
                fromCurrencyId: USD,
                id: "leg-1",
                toCurrencyId: AED,
              },
            ],
          }),
          legIndex: 0,
        }),
      ),
    ).toBe("Сбор + Выплата + Обмен");

    const routedDraft = createDraft({
      participants: [
        createDraft().participants[0]!,
        {
          binding: "bound",
          displayName: "Org A",
          entityId: "00000000-0000-4000-8000-000000000010",
          entityKind: "organization",
          nodeId: "node-org-a",
          requisiteId: null,
          role: "hop",
        },
        {
          binding: "bound",
          displayName: "Org B",
          entityId: "00000000-0000-4000-8000-000000000011",
          entityKind: "organization",
          nodeId: "node-org-b",
          requisiteId: null,
          role: "destination",
        },
      ],
      legs: [
        {
          fees: [],
          fromCurrencyId: USD,
          id: "leg-1",
          toCurrencyId: USD,
        },
        {
          fees: [],
          fromCurrencyId: USD,
          id: "leg-2",
          toCurrencyId: AED,
        },
      ],
      currencyOutId: AED,
    });

    expect(
      derivePaymentRouteLegSemantics({
        draft: routedDraft,
        legIndex: 0,
      }),
    ).toEqual(["collection"]);
    expect(
      derivePaymentRouteLegSemantics({
        draft: routedDraft,
        legIndex: 1,
      }),
    ).toEqual(["payout", "fx_conversion"]);

    const intraInterCounterpartyDraft = createDraft({
      participants: [
        {
          binding: "bound",
          displayName: "Org A",
          entityId: "00000000-0000-4000-8000-000000000010",
          entityKind: "organization",
          nodeId: "node-org-a",
          requisiteId: null,
          role: "source",
        },
        {
          binding: "bound",
          displayName: "Org A mirror",
          entityId: "00000000-0000-4000-8000-000000000010",
          entityKind: "organization",
          nodeId: "node-org-a-mirror",
          requisiteId: null,
          role: "hop",
        },
        {
          binding: "bound",
          displayName: "Core Bank",
          entityId: "00000000-0000-4000-8000-000000000020",
          entityKind: "counterparty",
          nodeId: "node-bank",
          requisiteId: null,
          role: "hop",
        },
        {
          binding: "bound",
          displayName: "Org B",
          entityId: "00000000-0000-4000-8000-000000000011",
          entityKind: "organization",
          nodeId: "node-org-b",
          requisiteId: null,
          role: "destination",
        },
      ],
      legs: [
        {
          fees: [],
          fromCurrencyId: USD,
          id: "leg-1",
          toCurrencyId: USD,
        },
        {
          fees: [],
          fromCurrencyId: USD,
          id: "leg-2",
          toCurrencyId: USD,
        },
        {
          fees: [],
          fromCurrencyId: USD,
          id: "leg-3",
          toCurrencyId: USD,
        },
      ],
    });

    expect(
      derivePaymentRouteLegSemantics({
        draft: intraInterCounterpartyDraft,
        legIndex: 1,
      }),
    ).toEqual(["counterparty_transfer"]);
    expect(formatPaymentRouteLegSemantics(["intracompany_transfer"])).toBe(
      "Внутренний перевод",
    );
    expect(formatPaymentRouteLegSemantics(["intercompany_transfer"])).toBe(
      "Межкомпанейский перевод",
    );
  });

  it("resolves participant operational currency for source, hop, and destination", () => {
    const draft = createDraft({
      currencyInId: USDT,
      currencyOutId: USD,
      legs: [
        {
          fees: [],
          fromCurrencyId: USDT,
          id: "leg-1",
          toCurrencyId: AED,
        },
        {
          fees: [],
          fromCurrencyId: AED,
          id: "leg-2",
          toCurrencyId: USD,
        },
      ],
      participants: [
        {
          binding: "bound",
          displayName: "Acme Customer",
          entityId: "00000000-0000-4000-8000-000000000001",
          entityKind: "customer",
          nodeId: "node-customer",
          requisiteId: null,
          role: "source",
        },
        {
          binding: "bound",
          displayName: "Dubai Bank",
          entityId: "00000000-0000-4000-8000-000000000002",
          entityKind: "organization",
          nodeId: "node-dubai",
          requisiteId: null,
          role: "hop",
        },
        {
          binding: "bound",
          displayName: "USA Bank",
          entityId: "00000000-0000-4000-8000-000000000003",
          entityKind: "organization",
          nodeId: "node-usa",
          requisiteId: null,
          role: "destination",
        },
      ],
    });

    expect(
      getPaymentRouteParticipantOperationalCurrency({
        draft,
        participantIndex: 0,
      }),
    ).toBe(USDT);
    expect(
      getPaymentRouteParticipantOperationalCurrency({
        draft,
        participantIndex: 1,
      }),
    ).toBe(AED);
    expect(
      getPaymentRouteParticipantOperationalCurrency({
        draft,
        participantIndex: 2,
      }),
    ).toBe(USD);
  });

  it("duplicates and archives templates without mutating the copied snapshot", async () => {
    const { service } = createService();
    const created = await service.commands.createTemplate({
      draft: createDraft(),
      name: "USD payout",
      visual: {
        nodePositions: {
          "node-customer": { x: 0, y: 0 },
          "node-org": { x: 200, y: 0 },
        },
        viewport: { x: 10, y: 20, zoom: 1.1 },
      },
    });

    const duplicate = await service.commands.duplicateTemplate(created.id);
    const archived = await service.commands.archiveTemplate(created.id);

    expect(archived.status).toBe("archived");
    expect(duplicate.status).toBe("active");
    expect(duplicate.name).toBe("USD payout (копия)");
    expect(duplicate.snapshotPolicy).toBe("clone_on_attach");
    expect(duplicate.visual).toEqual(created.visual);
    expect(duplicate.lastCalculation).toEqual(created.lastCalculation);
  });
});
