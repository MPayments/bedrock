import { describe, expect, it } from "vitest";

import { normalizeMajorAmountInput } from "@bedrock/shared/money";

import { RUSSIAN_MAJOR_AMOUNT_MESSAGES } from "../src/definitions/shared";
import {
  CapitalFundingInputSchema,
  CapitalFundingPayloadSchema,
  compileFxExecuteManualFinancialLines,
  FxExecuteInputSchema,
  FxExecutePayloadSchema,
  TransferIntraInputSchema,
  TransferIntraPayloadSchema,
} from "../src/validation";

describe("ifrs documents validation", () => {
  it("accepts API amount and maps it to amountMinor", () => {
    const parsed = TransferIntraInputSchema.parse({
      occurredAt: "2026-03-03T10:00:00.000Z",
      organizationId: "00000000-0000-4000-8000-000000000010",
      sourceRequisiteId: "00000000-0000-4000-8000-000000000001",
      destinationRequisiteId: "00000000-0000-4000-8000-000000000002",
      amount: "1000.50",
      currency: "usd",
    });

    expect(parsed.currency).toBe("USD");
    expect(parsed.amountMinor).toBe("100050");
    expect("amount" in parsed).toBe(false);
  });

  it("keeps payload parsing compatible with amountMinor", () => {
    const parsed = TransferIntraPayloadSchema.parse({
      occurredAt: "2026-03-03T10:00:00.000Z",
      organizationId: "00000000-0000-4000-8000-000000000010",
      sourceRequisiteId: "00000000-0000-4000-8000-000000000001",
      destinationRequisiteId: "00000000-0000-4000-8000-000000000002",
      amountMinor: "100050",
      currency: "USD",
    });

    expect(parsed.amountMinor).toBe("100050");
  });

  it("accepts capital funding without entryRef", () => {
    const parsed = CapitalFundingInputSchema.parse({
      occurredAt: "2026-03-03T10:00:00.000Z",
      kind: "founder_equity",
      organizationId: "00000000-0000-4000-8000-000000000010",
      organizationRequisiteId: "00000000-0000-4000-8000-000000000001",
      counterpartyId: "00000000-0000-4000-8000-000000000003",
      counterpartyRequisiteId: "00000000-0000-4000-8000-000000000004",
      amount: "1000.50",
      currency: "usd",
    });

    expect(parsed.entryRef).toBeUndefined();
    expect(parsed.currency).toBe("USD");
    expect(parsed.amountMinor).toBe("100050");
  });

  it("keeps capital funding payload parsing compatible without entryRef", () => {
    const parsed = CapitalFundingPayloadSchema.parse({
      occurredAt: "2026-03-03T10:00:00.000Z",
      kind: "founder_equity",
      organizationId: "00000000-0000-4000-8000-000000000010",
      organizationRequisiteId: "00000000-0000-4000-8000-000000000001",
      counterpartyId: "00000000-0000-4000-8000-000000000003",
      counterpartyRequisiteId: "00000000-0000-4000-8000-000000000004",
      amountMinor: "100050",
      currency: "USD",
    });

    expect(parsed.entryRef).toBeUndefined();
    expect(parsed.amountMinor).toBe("100050");
  });

  it("preserves localized major amount validation messages", () => {
    expect(() =>
      normalizeMajorAmountInput("abc", "USD", RUSSIAN_MAJOR_AMOUNT_MESSAGES),
    ).toThrow("Сумма должна быть числом, например 1000.50");
    expect(() =>
      normalizeMajorAmountInput("1.001", "USD", RUSSIAN_MAJOR_AMOUNT_MESSAGES),
    ).toThrow("Слишком много знаков после запятой для USD: максимум 2");
  });

  it("accepts fx_execute manual financial-line authoring rows and compiles them", () => {
    const parsed = FxExecuteInputSchema.parse({
      occurredAt: "2026-03-03T10:00:00.000Z",
      sourceRequisiteId: "00000000-0000-4000-8000-000000000001",
      destinationRequisiteId: "00000000-0000-4000-8000-000000000002",
      amount: "100.00",
      currency: "usd",
      financialLines: [
        {
          calcMethod: "percent",
          bucket: "fee_revenue",
          currency: "usd",
          percent: "1.5",
        },
      ],
    });

    expect(parsed.financialLines).toHaveLength(1);
    expect(parsed.financialLines[0]).toMatchObject({
      calcMethod: "percent",
      bucket: "fee_revenue",
      currency: "USD",
      percent: "1.5",
    });

    expect(
      compileFxExecuteManualFinancialLines({
        financialLines: parsed.financialLines,
        amountMinor: "10000",
        currency: "USD",
      }),
    ).toMatchObject([
      {
        calcMethod: "percent",
        percentBps: 150,
        bucket: "fee_revenue",
        currency: "USD",
        amountMinor: "150",
        source: "manual",
      },
    ]);
  });

  it("rejects invalid fx_execute percent rows when base currency is available", () => {
    expect(() =>
      FxExecuteInputSchema.parse({
        occurredAt: "2026-03-03T10:00:00.000Z",
        sourceRequisiteId: "00000000-0000-4000-8000-000000000001",
        destinationRequisiteId: "00000000-0000-4000-8000-000000000002",
        amount: "0.01",
        currency: "usd",
        financialLines: [
          {
            calcMethod: "percent",
            bucket: "fee_revenue",
            currency: "usd",
            percent: "0.01",
          },
        ],
      }),
    ).toThrow("percent-based financial line must not resolve to zero");

    expect(() =>
      FxExecuteInputSchema.parse({
        occurredAt: "2026-03-03T10:00:00.000Z",
        sourceRequisiteId: "00000000-0000-4000-8000-000000000001",
        destinationRequisiteId: "00000000-0000-4000-8000-000000000002",
        amount: "100.00",
        currency: "usd",
        financialLines: [
          {
            calcMethod: "percent",
            bucket: "fee_revenue",
            currency: "eur",
            percent: "1.25",
          },
        ],
      }),
    ).toThrow("percent-based financial line currency must match base currency USD");
  });

  it("keeps fx_execute payload parsing compatible with percent metadata", () => {
    const parsed = FxExecutePayloadSchema.parse({
      occurredAt: "2026-03-03T10:00:00.000Z",
      ownershipMode: "cross_org",
      sourceOrganizationId: "00000000-0000-4000-8000-000000000010",
      sourceRequisiteId: "00000000-0000-4000-8000-000000000001",
      destinationOrganizationId: "00000000-0000-4000-8000-000000000011",
      destinationRequisiteId: "00000000-0000-4000-8000-000000000002",
      amount: "100.00",
      amountMinor: "10000",
      quoteSnapshot: {
        quoteId: "00000000-0000-4000-8000-000000000020",
        idempotencyKey: "quote-ref-1",
        fromCurrency: "USD",
        toCurrency: "EUR",
        fromAmountMinor: "10000",
        toAmountMinor: "9200",
        pricingMode: "explicit_route",
        rateNum: "23",
        rateDen: "25",
        expiresAt: "2026-03-03T10:10:00.000Z",
        pricingTrace: { version: "v1", mode: "explicit_route" },
        legs: [
          {
            idx: 1,
            fromCurrency: "USD",
            toCurrency: "EUR",
            fromAmountMinor: "10000",
            toAmountMinor: "9200",
            rateNum: "23",
            rateDen: "25",
            sourceKind: "manual",
            sourceRef: "desk",
            asOf: "2026-03-03T10:00:00.000Z",
            executionCounterpartyId: null,
          },
        ],
        financialLines: [],
        snapshotHash:
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      },
      financialLines: [
        {
          id: "manual:1",
          bucket: "fee_revenue",
          currency: "USD",
          amount: "1.25",
          amountMinor: "125",
          source: "manual",
          settlementMode: "in_ledger",
          calcMethod: "percent",
          percentBps: 125,
        },
      ],
    });

    expect(parsed.financialLines[0]).toMatchObject({
      calcMethod: "percent",
      percentBps: 125,
    });
  });

  it("keeps fx_execute payload parsing compatible with frozen quote snapshots", () => {
    const parsed = FxExecutePayloadSchema.parse({
      occurredAt: "2026-03-03T10:00:00.000Z",
      ownershipMode: "cross_org",
      sourceOrganizationId: "00000000-0000-4000-8000-000000000010",
      sourceRequisiteId: "00000000-0000-4000-8000-000000000001",
      destinationOrganizationId: "00000000-0000-4000-8000-000000000011",
      destinationRequisiteId: "00000000-0000-4000-8000-000000000002",
      amount: "100.00",
      amountMinor: "10000",
      quoteSnapshot: {
        quoteId: "00000000-0000-4000-8000-000000000020",
        idempotencyKey: "quote-ref-1",
        fromCurrency: "USD",
        toCurrency: "EUR",
        fromAmountMinor: "10000",
        toAmountMinor: "9200",
        pricingMode: "explicit_route",
        rateNum: "23",
        rateDen: "25",
        expiresAt: "2026-03-03T10:10:00.000Z",
        pricingTrace: { version: "v1", mode: "explicit_route" },
        legs: [
          {
            idx: 1,
            fromCurrency: "USD",
            toCurrency: "EUR",
            fromAmountMinor: "10000",
            toAmountMinor: "9200",
            rateNum: "23",
            rateDen: "25",
            sourceKind: "manual",
            sourceRef: "desk",
            asOf: "2026-03-03T10:00:00.000Z",
            executionCounterpartyId: null,
          },
        ],
        financialLines: [],
        snapshotHash:
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      },
      financialLines: [],
    });

    expect(parsed.amountMinor).toBe("10000");
    expect(parsed.quoteSnapshot.quoteId).toBe(
      "00000000-0000-4000-8000-000000000020",
    );
    expect(parsed.ownershipMode).toBe("cross_org");
  });
});
