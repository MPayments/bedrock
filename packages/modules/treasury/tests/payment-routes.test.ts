import { describe, expect, it } from "vitest";

import { createModuleRuntime } from "@bedrock/shared/core";

import { createMockCurrenciesService, currencyIdForCode } from "./helpers";
import { createPaymentRoutesService } from "../src/payment-routes/application";
import {
  PaymentRouteCalculationFeeSchema,
  type PaymentRouteCalculation,
} from "../src/payment-routes/application/contracts/dto";
import {
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
        kind: "transfer",
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
              currencyId: USD,
              id: "fee-leg",
              kind: "fixed",
              label: "Hop",
            },
          ],
          fromCurrencyId: USD,
          id: "leg-1",
          kind: "transfer",
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
          id: "fee-extra",
          kind: "percent",
          label: "Bank",
          percentage: "5",
        },
      ],
      legs: [
        {
          fees: [
            {
              id: "fee-leg",
              kind: "percent",
              label: "Hop",
              percentage: "10",
            },
          ],
          fromCurrencyId: USD,
          id: "leg-1",
          kind: "transfer",
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
          kind: "transfer",
          toCurrencyId: currencyIdForCode("EUR"),
        },
      ],
    });

    const calculation = await service.queries.previewTemplate({ draft });

    expect(calculation.amountOutMinor).toBe("20000");
    expect(calculation.netAmountOutMinor).toBe("20000");
    expectCalculationTotal(calculation, USD, "20000");
  });

  it("accepts computed amount fields for percentage fees in calculations", () => {
    expect(() =>
      PaymentRouteCalculationFeeSchema.parse({
        amountMinor: "1000",
        currencyId: USD,
        id: "fee-leg",
        inputImpactCurrencyId: USD,
        inputImpactMinor: "1000",
        kind: "percent",
        label: "Hop",
        outputImpactCurrencyId: USD,
        outputImpactMinor: "1000",
        percentage: "10",
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
          kind: "collect",
          toCurrencyId: AED,
        },
        {
          fees: [
            {
              id: "fee-leg",
              kind: "percent",
              label: "FX spread",
              percentage: "10",
            },
          ],
          fromCurrencyId: AED,
          id: "leg-2",
          kind: "exchange",
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
              id: "fee-leg",
              kind: "percent",
              label: "Hop",
              percentage: "10",
            },
          ],
          fromCurrencyId: USD,
          id: "leg-1",
          kind: "transfer",
          toCurrencyId: USD,
        },
      ],
    });

    const calculation = await service.queries.previewTemplate({ draft });

    expect(calculation.amountInMinor).toBe("10000");
    expect(calculation.amountOutMinor).toBe("9000");
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
      lastCalculation: null,
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

  it("resolves participant operational currency for source, hop, and destination", () => {
    const draft = createDraft({
      currencyInId: USDT,
      currencyOutId: USD,
      legs: [
        {
          fees: [],
          fromCurrencyId: USDT,
          id: "leg-1",
          kind: "collect",
          toCurrencyId: AED,
        },
        {
          fees: [],
          fromCurrencyId: AED,
          id: "leg-2",
          kind: "exchange",
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
