import { describe, expect, it, vi } from "vitest";

import { ValidationError } from "@bedrock/shared/core/errors";

import { createDealPricingCommitWorkflow } from "../../src/composition/deal-pricing-commit-workflow";

function createQuoteResult() {
  return {
    benchmarks: [],
    formulaTrace: [],
    pricingMode: "explicit_route" as const,
    profitability: null,
    quote: {
      createdAt: new Date("2026-04-01T10:00:00.000Z"),
      dealDirection: null,
      dealForm: null,
      dealId: "deal-1",
      expiresAt: new Date("2026-04-01T10:05:00.000Z"),
      fromAmountMinor: 1000n,
      fromCurrency: "USD",
      fromCurrencyId: "currency-usd",
      id: "quote-1",
      idempotencyKey: "idem-1",
      pricingFingerprint: null,
      pricingMode: "explicit_route" as const,
      pricingTrace: {},
      rateDen: 10n,
      rateNum: 9n,
      status: "active" as const,
      toAmountMinor: 900n,
      toCurrency: "EUR",
      toCurrencyId: "currency-eur",
      usedAt: null,
      usedByRef: null,
      usedDocumentId: null,
    },
  };
}

function createInventoryQuote() {
  return {
    id: "quote-1",
    pricingTrace: {
      metadata: {
        crmPricingSnapshot: {
          clientSide: {
            beneficiaryAmountMinor: "900",
          },
          executionSide: {
            inventoryPositionId: "position-1",
            source: "treasury_inventory",
          },
          pnl: {},
        },
      },
    },
  };
}

function createHarness() {
  const calls: string[] = [];
  const acceptedProjection = {
    acceptedQuote: { quoteId: "quote-1" },
    summary: { id: "deal-1" },
  };
  const dealsModule = {
    deals: {
      commands: {
        acceptQuote: vi.fn(async () => {
          calls.push("acceptQuote");
          return acceptedProjection;
        }),
        appendTimelineEvent: vi.fn(async () => {
          calls.push("appendTimelineEvent");
        }),
      },
    },
  };
  const treasuryModule = {
    quotes: {
      queries: {
        findById: vi.fn(async () => createInventoryQuote()),
      },
    },
    treasuryOrders: {
      commands: {
        releaseInventoryAllocation: vi.fn(async () => {
          calls.push("releaseInventoryAllocation");
        }),
        reserveInventoryAllocation: vi.fn(async (input) => {
          calls.push("reserveInventoryAllocation");
          return {
            ...input,
            ledgerHoldRef: `treasury_inventory_allocation:${input.id}`,
          };
        }),
      },
      queries: {
        findInventoryPositionById: vi.fn(async () => ({
          currencyId: "currency-eur",
          ledgerSubjectType: "organization_requisite",
          ownerBookId: "book-1",
          ownerRequisiteId: "requisite-1",
        })),
        findReservedAllocationByDealAndQuote: vi.fn(async () => null),
        listInventoryAllocations: vi.fn(async () => ({
          data: [
            {
              currencyId: "currency-usd",
              id: "allocation-old",
              ledgerHoldRef: "treasury_inventory_allocation:allocation-old",
              ownerBookId: "book-old",
              ownerRequisiteId: "requisite-old",
              quoteId: "quote-old",
            },
          ],
          limit: 100,
          offset: 0,
          total: 1,
        })),
      },
    },
  };
  const ledgerModule = {
    balances: {
      commands: {
        release: vi.fn(async () => {
          calls.push("ledgerRelease");
        }),
        reserve: vi.fn(async () => {
          calls.push("ledgerReserve");
        }),
      },
      queries: {
        getBalance: vi.fn(async () => ({
          bookId: "book-1",
          currency: "EUR",
          subjectId: "requisite-1",
          subjectType: "organization_requisite",
        })),
      },
    },
  };
  const dealPricingWorkflow = {
    createQuote: vi.fn(async () => {
      calls.push("createQuote");
      return createQuoteResult();
    }),
  };
  const dealQuoteWorkflow = {
    createCalculationFromAcceptedQuote: vi.fn(async () => {
      calls.push("createCalculationFromAcceptedQuote");
      return { id: "calculation-1" };
    }),
  };
  const dealCommercialWorkflow = {
    autoMaterializeAfterQuoteAccept: vi.fn(async () => {
      calls.push("autoMaterializeAfterQuoteAccept");
    }),
  };
  const currencies = {
    findById: vi.fn(async (id: string) => ({
      code: id === "currency-usd" ? "USD" : "EUR",
      id,
    })),
  };
  const persistence = {
    runInTransaction: vi.fn(async (work) => work({ tx: true })),
  };
  const workflow = createDealPricingCommitWorkflow({
    currencies,
    createDealsModule: vi.fn(() => dealsModule as any),
    createLedgerModule: vi.fn(() => ledgerModule as any),
    createTreasuryModule: vi.fn(() => treasuryModule as any),
    dealCommercialWorkflow: dealCommercialWorkflow as any,
    dealPricingWorkflow: dealPricingWorkflow as any,
    dealQuoteWorkflow: dealQuoteWorkflow as any,
    dealsModule: dealsModule as any,
    persistence: persistence as any,
  });

  return {
    calls,
    currencies,
    dealCommercialWorkflow,
    dealPricingWorkflow,
    dealQuoteWorkflow,
    dealsModule,
    ledgerModule,
    persistence,
    treasuryModule,
    workflow,
  };
}

describe("deal pricing commit workflow", () => {
  it("accepts a standalone quote and owns inventory release, reserve, and auto-materialization", async () => {
    const harness = createHarness();

    await harness.workflow.acceptQuote({
      actorUserId: "user-1",
      dealId: "deal-1",
      quoteId: "quote-1",
      requestContext: {
        causationId: null,
        correlationId: "corr-1",
        idempotencyKey: null,
        requestId: "req-1",
        traceId: null,
      },
    });

    expect(harness.dealsModule.deals.commands.acceptQuote).toHaveBeenCalledWith(
      {
        actorUserId: "user-1",
        dealId: "deal-1",
        quoteId: "quote-1",
      },
    );
    expect(harness.ledgerModule.balances.commands.release).toHaveBeenCalledWith(
      expect.objectContaining({
        holdRef: "treasury_inventory_allocation:allocation-old",
        idempotencyKey:
          "accept:deal-1:quote-1:inventory-balance-release:allocation-old",
        subject: expect.objectContaining({
          bookId: "book-old",
          currency: "USD",
          subjectId: "requisite-old",
        }),
      }),
    );
    expect(harness.ledgerModule.balances.commands.reserve).toHaveBeenCalledWith(
      expect.objectContaining({
        amountMinor: 900n,
        idempotencyKey: "accept:deal-1:quote-1:inventory-balance-hold",
      }),
    );
    expect(
      harness.dealCommercialWorkflow.autoMaterializeAfterQuoteAccept,
    ).toHaveBeenCalledWith({
      actorUserId: "user-1",
      dealId: "deal-1",
      quoteId: "quote-1",
    });
  });

  it("commits route pricing in the existing order and returns quote result plus calculation id", async () => {
    const harness = createHarness();

    const result = await harness.workflow.commitRoutePricing({
      actorUserId: "user-1",
      dealId: "deal-1",
      idempotencyKey: "commit-1",
      pricing: {
        amountMinor: "1000",
        amountSide: "source",
        asOf: new Date("2026-04-01T10:00:00.000Z"),
        expectedRevision: 3,
      },
      requestContext: undefined,
    });

    expect(result).toEqual({
      quoteResult: createQuoteResult(),
      calculationId: "calculation-1",
    });
    expect(harness.calls).toEqual([
      "createQuote",
      "appendTimelineEvent",
      "acceptQuote",
      "ledgerRelease",
      "releaseInventoryAllocation",
      "ledgerReserve",
      "reserveInventoryAllocation",
      "createCalculationFromAcceptedQuote",
      "autoMaterializeAfterQuoteAccept",
    ]);
    expect(
      harness.dealQuoteWorkflow.createCalculationFromAcceptedQuote,
    ).toHaveBeenCalledWith({
      actorUserId: "user-1",
      dealId: "deal-1",
      idempotencyKey: "commit-1:calculation",
      quoteId: "quote-1",
    });
  });

  it("does not reserve ledger balance again when an allocation already exists", async () => {
    const harness = createHarness();
    harness.treasuryModule.treasuryOrders.queries.findReservedAllocationByDealAndQuote.mockResolvedValue(
      {
        id: "allocation-existing",
      },
    );

    await harness.workflow.acceptQuote({
      actorUserId: "user-1",
      dealId: "deal-1",
      quoteId: "quote-1",
      requestContext: undefined,
    });

    expect(
      harness.ledgerModule.balances.commands.reserve,
    ).not.toHaveBeenCalled();
    expect(
      harness.treasuryModule.treasuryOrders.commands.reserveInventoryAllocation,
    ).not.toHaveBeenCalled();
  });

  it("propagates missing inventory position and ledger reserve errors", async () => {
    const missingPosition = createHarness();
    missingPosition.treasuryModule.treasuryOrders.queries.findInventoryPositionById.mockResolvedValue(
      null,
    );

    await expect(
      missingPosition.workflow.acceptQuote({
        actorUserId: "user-1",
        dealId: "deal-1",
        quoteId: "quote-1",
        requestContext: undefined,
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    const ledgerFailure = createHarness();
    ledgerFailure.ledgerModule.balances.commands.reserve.mockRejectedValue(
      new Error("ledger reserve failed"),
    );

    await expect(
      ledgerFailure.workflow.acceptQuote({
        actorUserId: "user-1",
        dealId: "deal-1",
        quoteId: "quote-1",
        requestContext: undefined,
      }),
    ).rejects.toThrow("ledger reserve failed");
  });
});
