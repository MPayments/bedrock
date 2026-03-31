import { describe, expect, it, vi } from "vitest";

import { createModuleRuntime } from "@bedrock/shared/core";

import { CreateCalculationCommand } from "../../src/application/commands/create-calculation";
import {
  CalculationFxQuoteCurrencyMismatchError,
  CalculationFxQuoteRateMismatchError,
} from "../../src/errors";

function createLogger() {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  };
  logger.child.mockReturnValue(logger);
  return logger;
}

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
  const tx = {
    transaction: { id: "tx-1" } as any,
    calculationReads,
    calculationStore,
  };
  const commandUow = {
    run: vi.fn(async (work: (value: typeof tx) => Promise<unknown>) => work(tx)),
  };
  const idempotency = {
    withIdempotencyTx: vi.fn(async ({ handler }) => handler()),
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
    logger: createLogger(),
    generateUuid: () => uuids.shift() ?? "00000000-0000-4000-8000-000000000099",
    now: () => new Date("2026-03-30T12:00:00.000Z"),
  });
  const command = new CreateCalculationCommand(
    runtime,
    commandUow as any,
    idempotency as any,
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
      calculationCurrencyId: "00000000-0000-4000-8000-000000000001",
      originalAmountMinor: "10000",
      feeBps: "125",
      feeAmountMinor: "125",
      totalAmountMinor: "10125",
      baseCurrencyId: "00000000-0000-4000-8000-000000000002",
      feeAmountInBaseMinor: "100",
      totalInBaseMinor: "8100",
      additionalExpensesCurrencyId: null,
      additionalExpensesAmountMinor: "0",
      additionalExpensesInBaseMinor: "0",
      totalWithExpensesInBaseMinor: "8100",
      rateSource: "fx_quote",
      rateNum: "81",
      rateDen: "100",
      calculationTimestamp: "2026-03-30T12:00:00.000Z",
      fxQuoteId: "00000000-0000-4000-8000-000000000020",
    });

    expect(result).toBe(expected);
    expect(harness.commandUow.run).toHaveBeenCalledTimes(1);
    expect(harness.idempotency.withIdempotencyTx).toHaveBeenCalledTimes(1);
    expect(harness.calculationStore.createCalculationRoot).toHaveBeenCalledWith({
      id: "00000000-0000-4000-8000-000000000010",
    });
    expect(
      harness.calculationStore.createCalculationSnapshot,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "00000000-0000-4000-8000-000000000011",
        calculationId: "00000000-0000-4000-8000-000000000010",
        feeBps: 125n,
        rateNum: 81n,
        rateDen: 100n,
      }),
    );
    expect(harness.calculationStore.createCalculationLines).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: "original_amount",
        idx: 0,
        calculationSnapshotId: "00000000-0000-4000-8000-000000000011",
      }),
      expect.objectContaining({ kind: "fee_amount", idx: 1 }),
      expect.objectContaining({ kind: "total_amount", idx: 2 }),
      expect.objectContaining({ kind: "additional_expenses", idx: 3 }),
      expect.objectContaining({ kind: "fee_amount_in_base", idx: 4 }),
      expect.objectContaining({ kind: "total_in_base", idx: 5 }),
      expect.objectContaining({ kind: "additional_expenses_in_base", idx: 6 }),
      expect.objectContaining({
        kind: "total_with_expenses_in_base",
        idx: 7,
      }),
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
        calculationCurrencyId: "00000000-0000-4000-8000-000000000001",
        originalAmountMinor: "10000",
        feeBps: "125",
        feeAmountMinor: "125",
        totalAmountMinor: "10125",
        baseCurrencyId: "00000000-0000-4000-8000-000000000002",
        feeAmountInBaseMinor: "100",
        totalInBaseMinor: "8100",
        additionalExpensesCurrencyId: null,
        additionalExpensesAmountMinor: "0",
        additionalExpensesInBaseMinor: "0",
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
        calculationCurrencyId: "00000000-0000-4000-8000-000000000001",
        originalAmountMinor: "10000",
        feeBps: "125",
        feeAmountMinor: "125",
        totalAmountMinor: "10125",
        baseCurrencyId: "00000000-0000-4000-8000-000000000002",
        feeAmountInBaseMinor: "100",
        totalInBaseMinor: "8100",
        additionalExpensesCurrencyId: null,
        additionalExpensesAmountMinor: "0",
        additionalExpensesInBaseMinor: "0",
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
