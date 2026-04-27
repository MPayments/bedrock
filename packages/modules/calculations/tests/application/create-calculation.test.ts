import { describe, expect, it, vi } from "vitest";

import { createModuleRuntime } from "@bedrock/shared/core";
import { createTestLogger } from "@bedrock/test-utils";

import { CreateCalculationCommand } from "../../src/application/commands/create-calculation";
import {
  CalculationFxQuoteCurrencyMismatchError,
  CalculationFxQuoteRateMismatchError,
} from "../../src/errors";

function createHarness() {
  const calculationReads = {
    findById: vi.fn(),
  };
  const calculationStore = {
    createCalculationRoot: vi.fn(),
    createCalculationSnapshot: vi.fn(),
    createCalculationLines: vi.fn(),
    setCurrentSnapshot: vi.fn(),
  };
  const idempotency = {
    withIdempotency: vi.fn(async ({ handler }) => handler()),
  };
  const tx = {
    calculationReads,
    calculationStore,
    idempotency,
  };
  const commandUow = {
    run: vi.fn(async (work: (value: typeof tx) => Promise<unknown>) => work(tx)),
  };
  const references = {
    assertCurrencyExists: vi.fn(async () => undefined),
    findFxQuoteById: vi.fn(async () => ({
      id: "00000000-0000-4000-8000-000000000020",
      fromCurrencyId: "00000000-0000-4000-8000-000000000001",
      toCurrencyId: "00000000-0000-4000-8000-000000000002",
      rateNum: 81n,
      rateDen: 100n,
    })),
  };
  const uuids = [
    "00000000-0000-4000-8000-000000000010",
    "00000000-0000-4000-8000-000000000011",
    "00000000-0000-4000-8000-000000000012",
    "00000000-0000-4000-8000-000000000013",
    "00000000-0000-4000-8000-000000000014",
    "00000000-0000-4000-8000-000000000015",
    "00000000-0000-4000-8000-000000000016",
    "00000000-0000-4000-8000-000000000017",
    "00000000-0000-4000-8000-000000000018",
    "00000000-0000-4000-8000-000000000019",
  ];
  const runtime = createModuleRuntime({
    service: "calculations",
    logger: createTestLogger(),
    generateUuid: () => uuids.shift() ?? "00000000-0000-4000-8000-000000000099",
    now: () => new Date("2026-03-30T12:00:00.000Z"),
  });
  const command = new CreateCalculationCommand(
    runtime,
    commandUow as any,
    references,
  );

  return {
    calculationReads,
    calculationStore,
    commandUow,
    idempotency,
    references,
    handler: command.execute.bind(command),
  };
}

describe("create calculation command", () => {
  it("creates a calculation root, snapshot, derived lines, and current snapshot link", async () => {
    const harness = createHarness();
    const expected = {
      id: "00000000-0000-4000-8000-000000000010",
      isActive: true,
      currentSnapshot: {
        id: "00000000-0000-4000-8000-000000000011",
      },
      lines: [],
      createdAt: new Date("2026-03-30T12:00:00.000Z"),
      updatedAt: new Date("2026-03-30T12:00:00.000Z"),
    };
    harness.calculationReads.findById.mockResolvedValue(expected);

    const result = await harness.handler({
      actorUserId: "user-1",
      idempotencyKey: "calc-create-1",
      agreementVersionId: null,
      agreementFeeBps: "125",
      agreementFeeAmountMinor: "125",
      calculationCurrencyId: "00000000-0000-4000-8000-000000000001",
      originalAmountMinor: "10000",
      totalFeeBps: "125",
      totalFeeAmountMinor: "125",
      totalAmountMinor: "10125",
      baseCurrencyId: "00000000-0000-4000-8000-000000000002",
      totalFeeAmountInBaseMinor: "100",
      totalInBaseMinor: "8100",
      additionalExpensesCurrencyId: null,
      additionalExpensesAmountMinor: "0",
      additionalExpensesInBaseMinor: "0",
      fixedFeeAmountMinor: "0",
      fixedFeeCurrencyId: null,
      pricingProvenance: null,
      quoteMarkupAmountMinor: "0",
      quoteMarkupBps: "0",
      referenceRateAsOf: null,
      referenceRateSource: null,
      referenceRateNum: null,
      referenceRateDen: null,
      totalWithExpensesInBaseMinor: "8100",
      rateSource: "fx_quote",
      rateNum: "81",
      rateDen: "100",
      calculationTimestamp: "2026-03-30T12:00:00.000Z",
      fxQuoteId: "00000000-0000-4000-8000-000000000020",
      financialLines: [
        {
          kind: "fee_revenue",
          currencyId: "00000000-0000-4000-8000-000000000001",
          amountMinor: "125",
        },
        {
          kind: "pass_through",
          currencyId: "00000000-0000-4000-8000-000000000002",
          amountMinor: "10",
        },
      ],
      quoteSnapshot: { ref: "quote-1" },
    });

    expect(result).toBe(expected);
    expect(harness.commandUow.run).toHaveBeenCalledTimes(1);
    expect(harness.idempotency.withIdempotency).toHaveBeenCalledTimes(1);
    expect(harness.calculationStore.createCalculationRoot).toHaveBeenCalledWith({
      id: "00000000-0000-4000-8000-000000000010",
    });
    expect(
      harness.calculationStore.createCalculationSnapshot,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "00000000-0000-4000-8000-000000000011",
        calculationId: "00000000-0000-4000-8000-000000000010",
        agreementFeeBps: 125n,
        totalFeeBps: 125n,
        rateNum: 81n,
        rateDen: 100n,
        quoteSnapshot: { ref: "quote-1" },
      }),
    );
    expect(harness.calculationStore.createCalculationLines).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: "fee_revenue",
        idx: 0,
        calculationSnapshotId: "00000000-0000-4000-8000-000000000011",
      }),
      expect.objectContaining({ kind: "pass_through", idx: 1 }),
    ]);
    expect(harness.calculationStore.setCurrentSnapshot).toHaveBeenCalledWith({
      calculationId: "00000000-0000-4000-8000-000000000010",
      currentSnapshotId: "00000000-0000-4000-8000-000000000011",
    });
  });

  it("rejects quote currency mismatches", async () => {
    const harness = createHarness();
    harness.references.findFxQuoteById.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000020",
      fromCurrencyId: "00000000-0000-4000-8000-000000000099",
      toCurrencyId: "00000000-0000-4000-8000-000000000002",
      rateNum: 81n,
      rateDen: 100n,
    });

    await expect(
      harness.handler({
        actorUserId: "user-1",
        idempotencyKey: "calc-create-2",
        agreementVersionId: null,
        agreementFeeBps: "125",
        agreementFeeAmountMinor: "125",
        calculationCurrencyId: "00000000-0000-4000-8000-000000000001",
        originalAmountMinor: "10000",
        totalFeeBps: "125",
        totalFeeAmountMinor: "125",
        totalAmountMinor: "10125",
        baseCurrencyId: "00000000-0000-4000-8000-000000000002",
        totalFeeAmountInBaseMinor: "100",
        totalInBaseMinor: "8100",
        additionalExpensesCurrencyId: null,
        additionalExpensesAmountMinor: "0",
        additionalExpensesInBaseMinor: "0",
        fixedFeeAmountMinor: "0",
        fixedFeeCurrencyId: null,
        pricingProvenance: null,
        quoteMarkupAmountMinor: "0",
        quoteMarkupBps: "0",
        referenceRateAsOf: null,
        referenceRateSource: null,
        referenceRateNum: null,
        referenceRateDen: null,
        totalWithExpensesInBaseMinor: "8100",
        rateSource: "fx_quote",
        rateNum: "81",
        rateDen: "100",
        calculationTimestamp: "2026-03-30T12:00:00.000Z",
        fxQuoteId: "00000000-0000-4000-8000-000000000020",
      }),
    ).rejects.toBeInstanceOf(CalculationFxQuoteCurrencyMismatchError);
  });

  it("rejects quote rate mismatches", async () => {
    const harness = createHarness();
    harness.references.findFxQuoteById.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000020",
      fromCurrencyId: "00000000-0000-4000-8000-000000000001",
      toCurrencyId: "00000000-0000-4000-8000-000000000002",
      rateNum: 82n,
      rateDen: 100n,
    });

    await expect(
      harness.handler({
        actorUserId: "user-1",
        idempotencyKey: "calc-create-3",
        agreementVersionId: null,
        agreementFeeBps: "125",
        agreementFeeAmountMinor: "125",
        calculationCurrencyId: "00000000-0000-4000-8000-000000000001",
        originalAmountMinor: "10000",
        totalFeeBps: "125",
        totalFeeAmountMinor: "125",
        totalAmountMinor: "10125",
        baseCurrencyId: "00000000-0000-4000-8000-000000000002",
        totalFeeAmountInBaseMinor: "100",
        totalInBaseMinor: "8100",
        additionalExpensesCurrencyId: null,
        additionalExpensesAmountMinor: "0",
        additionalExpensesInBaseMinor: "0",
        fixedFeeAmountMinor: "0",
        fixedFeeCurrencyId: null,
        pricingProvenance: null,
        quoteMarkupAmountMinor: "0",
        quoteMarkupBps: "0",
        referenceRateAsOf: null,
        referenceRateSource: null,
        referenceRateNum: null,
        referenceRateDen: null,
        totalWithExpensesInBaseMinor: "8100",
        rateSource: "fx_quote",
        rateNum: "81",
        rateDen: "100",
        calculationTimestamp: "2026-03-30T12:00:00.000Z",
        fxQuoteId: "00000000-0000-4000-8000-000000000020",
      }),
    ).rejects.toBeInstanceOf(CalculationFxQuoteRateMismatchError);
  });
});
