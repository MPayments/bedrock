import { describe, expect, it, vi } from "vitest";

import { schema } from "@bedrock/application/fees/schema";
import { TransferCodes } from "@bedrock/application/ledger/constants";

import { FeeValidationError } from "../../src/fees/errors";
import { createFeesService } from "../../src/fees/service";

const QUOTE_ID = "11111111-1111-4111-8111-111111111111";

function createMockCurrenciesService() {
  const byCode = new Map<string, any>([
    [
      "USD",
      {
        id: "cur-usd",
        code: "USD",
        name: "US Dollar",
        symbol: "$",
        precision: 2,
      },
    ],
    [
      "EUR",
      { id: "cur-eur", code: "EUR", name: "Euro", symbol: "€", precision: 2 },
    ],
    [
      "RUB",
      {
        id: "cur-rub",
        code: "RUB",
        name: "Russian Ruble",
        symbol: "₽",
        precision: 2,
      },
    ],
    [
      "AED",
      {
        id: "cur-aed",
        code: "AED",
        name: "UAE Dirham",
        symbol: "د.إ",
        precision: 2,
      },
    ],
    [
      "USDT",
      {
        id: "cur-usdt",
        code: "USDT",
        name: "Tether",
        symbol: "₮",
        precision: 6,
      },
    ],
    [
      "BTC",
      {
        id: "cur-btc",
        code: "BTC",
        name: "Bitcoin",
        symbol: "₿",
        precision: 8,
      },
    ],
  ]);
  const byId = new Map<string, any>(
    Array.from(byCode.values()).map((currency) => [currency.id, currency]),
  );

  return {
    findByCode: vi.fn(async (code: string) => {
      const normalized = code.trim().toUpperCase();
      const existing = byCode.get(normalized);
      if (existing) return existing;
      const generated = {
        id: `cur-${normalized.toLowerCase()}`,
        code: normalized,
        name: normalized,
        symbol: normalized,
        precision: 2,
      };
      byCode.set(normalized, generated);
      byId.set(generated.id, generated);
      return generated;
    }),
    findById: vi.fn(async (id: string) => {
      const existing = byId.get(id);
      if (existing) return existing;
      throw new Error(`Unknown currency id: ${id}`);
    }),
  };
}

function createTestFeesService(deps: Record<string, any>) {
  return createFeesService({
    ...deps,
    currenciesService: deps.currenciesService ?? createMockCurrenciesService(),
  });
}

function feeComponent(overrides: Record<string, unknown> = {}) {
  return {
    id: "component-1",
    kind: "fx_fee",
    currency: "USD",
    amountMinor: 10n,
    source: "rule",
    settlementMode: "in_ledger",
    ...overrides,
  };
}

function adjustmentComponent(overrides: Record<string, unknown> = {}) {
  return {
    id: "adjustment-1",
    kind: "manual_adjustment",
    effect: "increase_charge",
    currency: "USD",
    amountMinor: 10n,
    source: "manual",
    settlementMode: "in_ledger",
    ...overrides,
  };
}

describe("createFeesService", () => {
  it("validates and calculates bps amounts with floor rounding", () => {
    const service = createTestFeesService({ db: {} as any });
    expect(service.calculateBpsAmount(12345n, 50)).toBe(61n);
    expect(() => service.calculateBpsAmount(-1n, 10)).toThrow(
      FeeValidationError,
    );
    expect(() => service.calculateBpsAmount(100n, -1)).toThrow(
      FeeValidationError,
    );
    expect(() => service.calculateBpsAmount(100n, 10_001)).toThrow(
      FeeValidationError,
    );
    expect(() => service.calculateBpsAmount(100n, 1.2)).toThrow(
      FeeValidationError,
    );
  });

  it("returns canonical defaults for known fee kinds and fallback", () => {
    const service = createTestFeesService({ db: {} as any });

    expect(service.getComponentDefaults("fx_fee")).toEqual({
      bucket: "fx_fee",
      transferCode: TransferCodes.FEE_INCOME,
      memo: "Fee revenue",
    });

    expect(service.getComponentDefaults("fx_spread")).toEqual({
      bucket: "fx_spread",
      transferCode: TransferCodes.SPREAD_INCOME,
      memo: "FX spread revenue",
    });

    expect(service.getComponentDefaults("bank_fee")).toEqual({
      bucket: "bank",
      transferCode: TransferCodes.FEE_INCOME,
      memo: "Bank fee revenue",
    });

    expect(service.getComponentDefaults("blockchain_fee")).toEqual({
      bucket: "blockchain",
      transferCode: TransferCodes.FEE_INCOME,
      memo: "Blockchain fee revenue",
    });

    expect(service.getComponentDefaults("manual_fee")).toEqual({
      bucket: "manual",
      transferCode: TransferCodes.FEE_INCOME,
      memo: "Manual fee",
    });

    expect(service.getComponentDefaults("unknown")).toEqual({
      bucket: "custom",
      transferCode: TransferCodes.FEE_INCOME,
      memo: "Fee revenue",
    });
  });

  it("persists fee rules with defaults and logs saved metadata", async () => {
    const values = vi.fn(() => ({
      returning: vi.fn(async () => [{ id: "rule-1" }]),
    }));
    const insert = vi.fn(() => ({ values }));
    const info = vi.fn();
    const logger = {
      child: vi.fn(() => ({ info })),
    };
    const service = createTestFeesService({
      db: { insert } as any,
      logger: logger as any,
    });

    const before = Date.now();
    const id = await service.upsertRule({
      name: "FX quote bps",
      operationKind: "fx_quote",
      feeKind: "fx_fee",
      calcMethod: "bps",
      bps: 35,
    });

    expect(id).toBe("rule-1");
    expect(insert).toHaveBeenCalledWith(schema.feeRules);

    const persisted = values.mock.calls[0]![0];
    expect(persisted.settlementMode).toBe("in_ledger");
    expect(persisted.priority).toBe(100);
    expect(persisted.isActive).toBe(true);
    expect(persisted.effectiveFrom).toBeInstanceOf(Date);
    expect((persisted.effectiveFrom as Date).getTime()).toBeGreaterThanOrEqual(
      before,
    );

    expect(logger.child).toHaveBeenCalledWith({ service: "fees" });
    expect(info).toHaveBeenCalledWith(
      "Fee rule persisted",
      expect.objectContaining({
        ruleId: "rule-1",
        operationKind: "fx_quote",
        feeKind: "fx_fee",
        calcMethod: "bps",
      }),
    );
  });

  it("lists applicable rules for both scoped and wildcard lookups", async () => {
    const orderBy = vi
      .fn()
      .mockResolvedValueOnce([{ id: "scoped-rule" }])
      .mockResolvedValueOnce([{ id: "wildcard-rule" }]);
    const where = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const service = createTestFeesService({ db: { select } as any });
    const at = new Date("2026-02-14T00:00:00Z");

    await expect(
      service.listApplicableRules({
        operationKind: "fx_quote",
        at,
        fromCurrency: "usd",
        toCurrency: "eur",
        dealDirection: "cash_to_wire",
        dealForm: "conversion",
      }),
    ).resolves.toEqual([{ id: "scoped-rule" }]);

    await expect(
      service.listApplicableRules({
        operationKind: "fx_quote",
        at,
      }),
    ).resolves.toEqual([{ id: "wildcard-rule" }]);

    expect(orderBy).toHaveBeenCalledTimes(2);
  });

  it("calculates FX quote fee components and drops non-chargeable rules", async () => {
    const rules = [
      {
        id: "r-bps",
        calcMethod: "bps",
        bps: 50,
        fixedAmountMinor: null,
        fixedCurrency: null,
        feeKind: "fx_fee",
        settlementMode: "in_ledger",
        debitAccountKey: null,
        creditAccountKey: null,
        transferCode: null,
        memo: null,
        metadata: null,
      },
      {
        id: "r-bps-null",
        calcMethod: "bps",
        bps: null,
        fixedAmountMinor: null,
        fixedCurrency: null,
        feeKind: "fx_fee",
        settlementMode: "in_ledger",
        debitAccountKey: null,
        creditAccountKey: null,
        transferCode: null,
        memo: null,
        metadata: null,
      },
      {
        id: "r-fixed-zero",
        calcMethod: "fixed",
        bps: null,
        fixedAmountMinor: 0n,
        fixedCurrency: "usd",
        feeKind: "bank_fee",
        settlementMode: "in_ledger",
        debitAccountKey: null,
        creditAccountKey: null,
        transferCode: null,
        memo: null,
        metadata: null,
      },
      {
        id: "r-fixed-eur",
        calcMethod: "fixed",
        bps: null,
        fixedAmountMinor: 200n,
        fixedCurrencyId: "cur-eur",
        feeKind: "bank_fee",
        settlementMode: "separate_payment_order",
        debitAccountKey: "Account:branch:fees:EUR",
        creditAccountKey: "Account:treasury:revenue:EUR",
        transferCode: 777,
        memo: "External fee",
        metadata: { channel: "swift" },
      },
      {
        id: "r-fixed-default-ccy",
        calcMethod: "fixed",
        bps: null,
        fixedAmountMinor: 120n,
        fixedCurrency: null,
        feeKind: "manual_fee",
        settlementMode: "in_ledger",
        debitAccountKey: null,
        creditAccountKey: null,
        transferCode: null,
        memo: null,
        metadata: null,
      },
    ];

    const orderBy = vi.fn(async () => rules);
    const where = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const service = createTestFeesService({ db: { select } as any });

    const components = await service.calculateFxQuoteFeeComponents({
      fromCurrency: "usd",
      toCurrency: "eur",
      principalMinor: 12_345n,
      at: new Date("2026-02-14T00:00:00Z"),
      dealDirection: "cash_to_wire",
      dealForm: "conversion",
    });

    expect(components).toHaveLength(3);
    expect(components[0]).toMatchObject({
      id: "rule:r-bps",
      kind: "fx_fee",
      currency: "USD",
      amountMinor: 61n,
      source: "rule",
    });
    expect(components[1]).toMatchObject({
      id: "rule:r-fixed-eur",
      kind: "bank_fee",
      currency: "EUR",
      amountMinor: 200n,
      settlementMode: "separate_payment_order",
      memo: "External fee",
      metadata: { channel: "swift" },
    });
    expect(components[2]).toMatchObject({
      id: "rule:r-fixed-default-ccy",
      kind: "manual_fee",
      currency: "USD",
      amountMinor: 120n,
    });
  });

  it("replaces quote snapshot components and defaults settlement mode", async () => {
    const where = vi.fn(async () => undefined);
    const deleteFn = vi.fn(() => ({ where }));
    const values = vi.fn(() => ({}));
    const insert = vi.fn(() => ({ values }));
    const service = createTestFeesService({
      db: { delete: deleteFn, insert } as any,
    });

    await service.saveQuoteFeeComponents({
      quoteId: QUOTE_ID,
      components: [
        feeComponent({ id: "c1", currency: "usd", settlementMode: undefined }),
        feeComponent({
          id: "c2",
          kind: "fx_spread",
          amountMinor: 3n,
          settlementMode: "separate_payment_order",
        }),
      ] as any,
    });

    expect(deleteFn).toHaveBeenCalledWith(schema.fxQuoteFeeComponents);
    expect(values).toHaveBeenCalledWith([
      expect.objectContaining({
        quoteId: QUOTE_ID,
        idx: 1,
        currencyId: "cur-usd",
        settlementMode: "in_ledger",
      }),
      expect.objectContaining({
        quoteId: QUOTE_ID,
        idx: 2,
        currencyId: "cur-usd",
        settlementMode: "separate_payment_order",
      }),
    ]);
  });

  it("deletes quote snapshot components without inserting when list is empty", async () => {
    const where = vi.fn(async () => undefined);
    const deleteFn = vi.fn(() => ({ where }));
    const insert = vi.fn(() => ({ values: vi.fn() }));
    const service = createTestFeesService({
      db: { delete: deleteFn, insert } as any,
    });

    await service.saveQuoteFeeComponents({
      quoteId: QUOTE_ID,
      components: [],
    });

    expect(deleteFn).toHaveBeenCalledWith(schema.fxQuoteFeeComponents);
    expect(insert).not.toHaveBeenCalled();
  });

  it("reads quote snapshot components in deterministic order", async () => {
    const rows = [
      {
        quoteId: QUOTE_ID,
        idx: 2,
        ruleId: null,
        kind: "fx_spread",
        currencyId: "cur-usd",
        amountMinor: 8n,
        source: "rule",
        settlementMode: "in_ledger",
        debitAccountKey: null,
        creditAccountKey: null,
        transferCode: null,
        memo: null,
        metadata: null,
      },
      {
        quoteId: QUOTE_ID,
        idx: 1,
        ruleId: "11111111-1111-4111-8111-111111111112",
        kind: "fx_fee",
        currencyId: "cur-usd",
        amountMinor: 12n,
        source: "rule",
        settlementMode: "separate_payment_order",
        debitAccountKey: "Account:from",
        creditAccountKey: "Account:to",
        transferCode: 44,
        memo: "fee",
        metadata: { reason: "rule" },
      },
    ];
    const limit = vi.fn(async () => rows);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const service = createTestFeesService({ db: { select } as any });

    const components = await service.getQuoteFeeComponents({
      quoteId: QUOTE_ID,
    });

    expect(components.map((x) => x.id)).toEqual([
      `quote_component:${QUOTE_ID}:1`,
      `quote_component:${QUOTE_ID}:2`,
    ]);
    expect(components[0]).toMatchObject({
      ruleId: "11111111-1111-4111-8111-111111111112",
      memo: "fee",
      metadata: { reason: "rule" },
      settlementMode: "separate_payment_order",
    });
    expect(components[1]).toMatchObject({
      ruleId: undefined,
      memo: undefined,
      metadata: undefined,
    });
  });

  it("aggregates, merges and partitions components by settlement and posting identity", () => {
    const service = createTestFeesService({ db: {} as any });

    const aggregated = service.aggregateFeeComponents([
      feeComponent({ id: "a1", amountMinor: 10n, memo: "revenue" }),
      feeComponent({ id: "a2", amountMinor: 5n, memo: "revenue" }),
      feeComponent({ id: "zero", amountMinor: 0n }),
      feeComponent({
        id: "sep",
        amountMinor: 7n,
        settlementMode: "separate_payment_order",
        memo: "revenue",
      }),
    ] as any);

    expect(aggregated).toHaveLength(2);
    expect(
      aggregated.find((x) => x.settlementMode === "in_ledger")!.amountMinor,
    ).toBe(15n);
    expect(
      aggregated.find((x) => x.settlementMode === "separate_payment_order")!
        .amountMinor,
    ).toBe(7n);

    const mergedRaw = service.mergeFeeComponents({
      computed: [feeComponent({ id: "m1", amountMinor: 4n }) as any],
      manual: [feeComponent({ id: "m2", amountMinor: 6n }) as any],
      aggregate: false,
    });
    expect(mergedRaw).toHaveLength(2);

    const mergedAggregated = service.mergeFeeComponents({
      computed: [
        feeComponent({ id: "m1", amountMinor: 4n, memo: "same" }) as any,
      ],
      manual: [
        feeComponent({ id: "m2", amountMinor: 6n, memo: "same" }) as any,
      ],
    });
    expect(mergedAggregated).toHaveLength(1);
    expect(mergedAggregated[0]!.amountMinor).toBe(10n);

    const partitioned = service.partitionFeeComponents([
      feeComponent({ id: "p1", settlementMode: undefined }),
      feeComponent({ id: "p2", settlementMode: "separate_payment_order" }),
    ] as any);
    expect(partitioned.inLedger).toHaveLength(1);
    expect(partitioned.inLedger[0]!.settlementMode).toBe("in_ledger");
    expect(partitioned.separatePaymentOrder).toHaveLength(1);
  });

  it("aggregates, merges and partitions adjustment components", () => {
    const service = createTestFeesService({ db: {} as any });

    const aggregated = service.aggregateAdjustmentComponents([
      adjustmentComponent({ id: "a1", amountMinor: 5n, memo: "same" }),
      adjustmentComponent({ id: "a2", amountMinor: 7n, memo: "same" }),
      adjustmentComponent({
        id: "a3",
        settlementMode: "separate_payment_order",
        amountMinor: 3n,
      }),
    ] as any);

    expect(aggregated).toHaveLength(2);
    expect(
      aggregated.find((x) => x.settlementMode === "in_ledger")!.amountMinor,
    ).toBe(12n);
    expect(
      aggregated.find((x) => x.settlementMode === "separate_payment_order")!
        .amountMinor,
    ).toBe(3n);

    const mergedRaw = service.mergeAdjustmentComponents({
      computed: [adjustmentComponent({ id: "m1", amountMinor: 4n }) as any],
      manual: [adjustmentComponent({ id: "m2", amountMinor: 6n }) as any],
      aggregate: false,
    });
    expect(mergedRaw).toHaveLength(2);

    const mergedAggregated = service.mergeAdjustmentComponents({
      computed: [
        adjustmentComponent({ id: "m1", amountMinor: 4n, memo: "same" }) as any,
      ],
      manual: [
        adjustmentComponent({ id: "m2", amountMinor: 6n, memo: "same" }) as any,
      ],
    });
    expect(mergedAggregated).toHaveLength(1);
    expect(mergedAggregated[0]!.amountMinor).toBe(10n);

    const partitioned = service.partitionAdjustmentComponents([
      adjustmentComponent({ id: "p1", settlementMode: undefined }),
      adjustmentComponent({
        id: "p2",
        settlementMode: "separate_payment_order",
      }),
    ] as any);
    expect(partitioned.inLedger).toHaveLength(1);
    expect(partitioned.inLedger[0]!.settlementMode).toBe("in_ledger");
    expect(partitioned.separatePaymentOrder).toHaveLength(1);
  });
});
