import { describe, expect, it, vi } from "vitest";

import { createModuleRuntime } from "@bedrock/shared/core";
import { createTestLogger } from "@bedrock/test-utils";

import { CreateCalculationCommand } from "../../src/application/commands/create-calculation";
import { CreateCalculationFromAcceptedQuoteCommand } from "../../src/application/commands/create-from-accepted-quote";
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
    run: vi.fn(async (work: (value: typeof tx) => Promise<unknown>) =>
      work(tx),
    ),
  };
  const references = {
    assertCurrencyExists: vi.fn(async () => undefined),
    findCurrencyByCode: vi.fn(async (code: string) => ({
      code,
      id:
        code === "USD"
          ? "00000000-0000-4000-8000-000000000001"
          : code === "EUR"
            ? "00000000-0000-4000-8000-000000000002"
            : "00000000-0000-4000-8000-000000000003",
    })),
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
  const fromAcceptedQuoteCommand =
    new CreateCalculationFromAcceptedQuoteCommand(command, references);

  return {
    calculationReads,
    calculationStore,
    commandUow,
    idempotency,
    references,
    handler: command.execute.bind(command),
    fromAcceptedQuoteHandler: fromAcceptedQuoteCommand.execute.bind(
      fromAcceptedQuoteCommand,
    ),
  };
}

function createAcceptedQuoteDetails(
  overrides: {
    acceptedAgreementVersionId?: string | null;
    commercialTerms?: Record<string, unknown> | null;
    financialLines?: Record<string, unknown>[];
    fromAmountMinor?: bigint;
    fromCurrency?: string;
    fromCurrencyId?: string;
    id?: string;
    rateDen?: bigint;
    rateNum?: bigint;
    toAmountMinor?: bigint;
    toCurrency?: string;
    toCurrencyId?: string;
  } = {},
) {
  return {
    feeComponents: [],
    financialLines: overrides.financialLines ?? [
      {
        id: "line-1",
        amountMinor: 100n,
        bucket: "fee_revenue",
        currency: "USD",
        source: "rule",
      },
      {
        id: "line-2",
        amountMinor: 50n,
        bucket: "pass_through",
        currency: "EUR",
        source: "rule",
      },
    ],
    legs: [],
    pricingTrace: {},
    quote: {
      commercialTerms:
        overrides.commercialTerms === undefined
          ? {
              agreementVersionId:
                overrides.acceptedAgreementVersionId ??
                "00000000-0000-4000-8000-000000000101",
              agreementFeeBps: 100n,
              quoteMarkupBps: 0n,
              totalFeeBps: 100n,
              fixedFeeAmountMinor: 50n,
              fixedFeeCurrency: "EUR",
            }
          : overrides.commercialTerms,
      createdAt: new Date("2026-04-01T10:00:00.000Z"),
      dealDirection: null,
      dealForm: null,
      dealId: "00000000-0000-4000-8000-000000000301",
      expiresAt: new Date("2099-04-01T11:00:00.000Z"),
      fromAmountMinor: overrides.fromAmountMinor ?? 10000n,
      fromCurrency: overrides.fromCurrency ?? "USD",
      fromCurrencyId:
        overrides.fromCurrencyId ?? "00000000-0000-4000-8000-000000000001",
      id: overrides.id ?? "00000000-0000-4000-8000-000000000020",
      idempotencyKey: "quote-1",
      pricingFingerprint: null,
      pricingMode: "auto_cross",
      pricingTrace: {},
      rateDen: overrides.rateDen ?? 10n,
      rateNum: overrides.rateNum ?? 9n,
      status: "active",
      toAmountMinor: overrides.toAmountMinor ?? 9000n,
      toCurrency: overrides.toCurrency ?? "EUR",
      toCurrencyId:
        overrides.toCurrencyId ?? "00000000-0000-4000-8000-000000000002",
      usedAt: null,
      usedByRef: null,
      usedDocumentId: null,
    },
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
    expect(harness.calculationStore.createCalculationRoot).toHaveBeenCalledWith(
      {
        id: "00000000-0000-4000-8000-000000000010",
      },
    );
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
    expect(
      harness.calculationStore.createCalculationLines,
    ).toHaveBeenCalledWith([
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

  it("creates accepted quote calculations with expected economics", async () => {
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
    harness.references.findFxQuoteById.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000020",
      fromCurrencyId: "00000000-0000-4000-8000-000000000001",
      toCurrencyId: "00000000-0000-4000-8000-000000000002",
      rateNum: 9n,
      rateDen: 10n,
    });

    const result = await harness.fromAcceptedQuoteHandler({
      actorUserId: "user-1",
      acceptedAgreementVersionId: "00000000-0000-4000-8000-000000000101",
      idempotencyKey: "calc-from-quote-1",
      quoteDetails: createAcceptedQuoteDetails() as any,
      quoteSnapshot: { quote: { id: "00000000-0000-4000-8000-000000000020" } },
    });

    expect(result).toBe(expected);
    expect(
      harness.calculationStore.createCalculationSnapshot,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        agreementVersionId: "00000000-0000-4000-8000-000000000101",
        agreementFeeAmountMinor: 100n,
        agreementFeeBps: 100n,
        additionalExpensesAmountMinor: 50n,
        additionalExpensesCurrencyId: "00000000-0000-4000-8000-000000000002",
        additionalExpensesInBaseMinor: 50n,
        baseCurrencyId: "00000000-0000-4000-8000-000000000002",
        calculationCurrencyId: "00000000-0000-4000-8000-000000000001",
        fixedFeeAmountMinor: 50n,
        fixedFeeCurrencyId: "00000000-0000-4000-8000-000000000002",
        fxQuoteId: "00000000-0000-4000-8000-000000000020",
        originalAmountMinor: 10000n,
        quoteMarkupAmountMinor: 0n,
        quoteMarkupBps: 0n,
        rateDen: 10n,
        rateNum: 9n,
        rateSource: "fx_quote",
        totalAmountMinor: 10100n,
        totalFeeAmountInBaseMinor: 90n,
        totalFeeAmountMinor: 100n,
        totalFeeBps: 100n,
        totalInBaseMinor: 9000n,
        totalWithExpensesInBaseMinor: 9140n,
      }),
    );
    expect(
      harness.calculationStore.createCalculationLines,
    ).toHaveBeenCalledWith([
      expect.objectContaining({
        amountMinor: 100n,
        currencyId: "00000000-0000-4000-8000-000000000001",
        kind: "fee_revenue",
      }),
      expect.objectContaining({
        amountMinor: 50n,
        currencyId: "00000000-0000-4000-8000-000000000002",
        kind: "pass_through",
      }),
    ]);
  });

  it("rounds accepted quote economics and ignores route-embedded expenses", async () => {
    const harness = createHarness();
    harness.calculationReads.findById.mockResolvedValue({ id: "calc-1" });
    harness.references.findFxQuoteById.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000020",
      fromCurrencyId: "00000000-0000-4000-8000-000000000001",
      toCurrencyId: "00000000-0000-4000-8000-000000000002",
      rateNum: 1n,
      rateDen: 2n,
    });

    await harness.fromAcceptedQuoteHandler({
      actorUserId: "user-1",
      acceptedAgreementVersionId: "00000000-0000-4000-8000-000000000101",
      idempotencyKey: "calc-from-quote-2",
      quoteDetails: createAcceptedQuoteDetails({
        financialLines: [
          {
            id: "line-1",
            amountMinor: 200n,
            bucket: "pass_through",
            currency: "USD",
            metadata: {
              embeddedInRoute: "true",
            },
            source: "manual",
          },
          {
            id: "line-2",
            amountMinor: 1n,
            bucket: "pass_through",
            currency: "USD",
            source: "manual",
          },
        ],
        fromAmountMinor: 50n,
        rateDen: 2n,
        rateNum: 1n,
        toAmountMinor: 25n,
      }) as any,
    });

    expect(
      harness.calculationStore.createCalculationSnapshot,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        additionalExpensesAmountMinor: 1n,
        additionalExpensesCurrencyId: "00000000-0000-4000-8000-000000000001",
        additionalExpensesInBaseMinor: 1n,
        agreementFeeAmountMinor: 1n,
        fixedFeeAmountMinor: 50n,
        totalFeeAmountInBaseMinor: 1n,
        totalFeeAmountMinor: 1n,
        totalAmountMinor: 51n,
        totalWithExpensesInBaseMinor: 27n,
      }),
    );
  });

  it("rejects invalid accepted quote expense and agreement shapes", async () => {
    const harness = createHarness();

    await expect(
      harness.fromAcceptedQuoteHandler({
        actorUserId: "user-1",
        acceptedAgreementVersionId: "00000000-0000-4000-8000-000000000101",
        idempotencyKey: "calc-from-quote-negative",
        quoteDetails: createAcceptedQuoteDetails({
          financialLines: [
            {
              id: "line-1",
              amountMinor: -1n,
              bucket: "pass_through",
              currency: "EUR",
              source: "manual",
            },
          ],
        }) as any,
      }),
    ).rejects.toThrow("negative pass_through total");

    await expect(
      harness.fromAcceptedQuoteHandler({
        actorUserId: "user-1",
        acceptedAgreementVersionId: "00000000-0000-4000-8000-000000000101",
        idempotencyKey: "calc-from-quote-multiple",
        quoteDetails: createAcceptedQuoteDetails({
          financialLines: [
            {
              id: "line-1",
              amountMinor: 1n,
              bucket: "pass_through",
              currency: "USD",
              source: "manual",
            },
            {
              id: "line-2",
              amountMinor: 1n,
              bucket: "pass_through",
              currency: "EUR",
              source: "manual",
            },
          ],
        }) as any,
      }),
    ).rejects.toThrow("single currency");

    await expect(
      harness.fromAcceptedQuoteHandler({
        actorUserId: "user-1",
        acceptedAgreementVersionId: "00000000-0000-4000-8000-000000000101",
        idempotencyKey: "calc-from-quote-currency",
        quoteDetails: createAcceptedQuoteDetails({
          financialLines: [
            {
              id: "line-1",
              amountMinor: 1n,
              bucket: "pass_through",
              currency: "GBP",
              source: "manual",
            },
          ],
        }) as any,
      }),
    ).rejects.toThrow("unsupported for quote");

    await expect(
      harness.fromAcceptedQuoteHandler({
        actorUserId: "user-1",
        acceptedAgreementVersionId: "00000000-0000-4000-8000-000000000999",
        idempotencyKey: "calc-from-quote-agreement",
        quoteDetails: createAcceptedQuoteDetails() as any,
      }),
    ).rejects.toThrow("agreementVersionId does not match");
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
