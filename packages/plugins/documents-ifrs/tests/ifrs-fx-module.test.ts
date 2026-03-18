import { describe, expect, it, vi } from "vitest";

import {
  ACCOUNTING_SOURCE_ID,
  OPERATION_CODE,
  POSTING_TEMPLATE_KEY,
} from "@bedrock/accounting/posting-contracts";

import { createFxExecuteDocumentModule } from "../src/documents/fx-execute";
import { createFxResolutionDocumentModule } from "../src/documents/fx-resolution";

function createQuoteSnapshot() {
  return {
    quoteId: "00000000-0000-4000-8000-000000000010",
    idempotencyKey: "quote-ref-1",
    fromCurrency: "USD",
    toCurrency: "EUR",
    fromAmountMinor: "10000",
    toAmountMinor: "9200",
    pricingMode: "explicit_route" as const,
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
        sourceKind: "manual" as const,
        sourceRef: "desk",
        asOf: "2026-03-03T10:00:00.000Z",
        executionCounterpartyId: null,
      },
    ],
    financialLines: [
      {
        id: "quote-line-1",
        bucket: "spread_revenue" as const,
        currency: "USD",
        amount: "0.5",
        amountMinor: "50",
        source: "rule" as const,
        settlementMode: "in_ledger" as const,
      },
    ],
    snapshotHash:
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  };
}

function createDeps() {
  const quoteSnapshot = createQuoteSnapshot();

  return {
    requisitesService: {
      resolveBindings: vi.fn(async ({ requisiteIds }: { requisiteIds: string[] }) =>
        requisiteIds.map((requisiteId, index) => ({
          requisiteId,
          bookId:
            index === 0
              ? "00000000-0000-4000-8000-000000000211"
              : "00000000-0000-4000-8000-000000000212",
          organizationId:
            index === 0
              ? "00000000-0000-4000-8000-000000000311"
              : "00000000-0000-4000-8000-000000000312",
          currencyCode: index === 0 ? "USD" : "EUR",
          postingAccountNo: "1110",
          bookAccountInstanceId:
            index === 0
              ? "00000000-0000-4000-8000-000000000411"
              : "00000000-0000-4000-8000-000000000412",
        })),
      ),
      findById: vi.fn(),
    },
    transferLookup: {
      resolveTransferDependencyDocument: vi.fn(),
      listPendingTransfers: vi.fn(async () => []),
    },
    fxExecuteLookup: {
      resolveFxExecuteDependencyDocument: vi.fn(async () => ({
        id: "00000000-0000-4000-8000-000000000601",
        docType: "fx_execute",
        occurredAt: new Date("2026-03-03T10:00:00.000Z"),
        payload: createFxExecutePayload(),
      })),
      listPendingTransfers: vi.fn(async () => [
        {
          transferId: 101n,
          pendingRef: "fx_execute:00000000-0000-4000-8000-000000000601:source",
          amountMinor: 10000n,
        },
        {
          transferId: 102n,
          pendingRef:
            "fx_execute:00000000-0000-4000-8000-000000000601:destination",
          amountMinor: 9200n,
        },
      ]),
    },
    treasuryFxQuote: {
      createQuoteSnapshot: vi.fn(async () => quoteSnapshot),
      loadQuoteSnapshotById: vi.fn(async () => quoteSnapshot),
    },
    quoteUsage: {
      markQuoteUsedForFxExecute: vi.fn(async () => undefined),
    },
  };
}

function createFxExecutePayload() {
  return {
    occurredAt: "2026-03-03T10:00:00.000Z",
    ownershipMode: "cross_org",
    sourceOrganizationId: "00000000-0000-4000-8000-000000000311",
    sourceRequisiteId: "00000000-0000-4000-8000-000000000111",
    destinationOrganizationId: "00000000-0000-4000-8000-000000000312",
    destinationRequisiteId: "00000000-0000-4000-8000-000000000112",
    amount: "100.00",
    amountMinor: "10000",
    quoteSnapshot: createQuoteSnapshot(),
    financialLines: [
      {
        id: "quote-line-1",
        bucket: "spread_revenue",
        currency: "USD",
        amount: "0.5",
        amountMinor: "50",
        source: "rule",
        settlementMode: "in_ledger",
      },
      {
        id: "manual-line-1",
        bucket: "adjustment",
        currency: "USD",
        amount: "0.25",
        amountMinor: "25",
        source: "manual",
        settlementMode: "in_ledger",
      },
    ],
    executionRef: "exec-1",
    memo: "desk conversion",
  };
}

describe("ifrs fx modules", () => {
  it("accepts treasury fx creation for cross-org different-currency requisites", async () => {
    const module = createFxExecuteDocumentModule(createDeps() as any);

    await expect(
      module.canCreate?.(
        { runtime: {} } as any,
        {
          occurredAt: new Date("2026-03-03T10:00:00.000Z"),
          sourceRequisiteId: "00000000-0000-4000-8000-000000000111",
          destinationRequisiteId: "00000000-0000-4000-8000-000000000112",
          amount: "100.00",
          memo: "desk conversion",
          financialLines: [],
        },
      ),
    ).resolves.toBeUndefined();
  });

  it("creates a draft from current rates and freezes the generated quote snapshot", async () => {
    const deps = createDeps();
    const module = createFxExecuteDocumentModule(deps as any);
    const runtime = {} as any;

    const draft = await module.createDraft(
      {
        runtime,
        now: new Date("2026-03-03T10:00:00.000Z"),
        operationIdempotencyKey: "create-idem",
      } as any,
      {
        occurredAt: new Date("2026-03-03T10:00:00.000Z"),
        sourceRequisiteId: "00000000-0000-4000-8000-000000000111",
        destinationRequisiteId: "00000000-0000-4000-8000-000000000112",
        amount: "100.00",
        memo: "desk conversion",
        financialLines: [],
      },
    );

    expect(deps.treasuryFxQuote.createQuoteSnapshot).toHaveBeenCalledWith({
      runtime,
      fromCurrency: "USD",
      toCurrency: "EUR",
      fromAmountMinor: "10000",
      asOf: new Date("2026-03-03T10:00:00.000Z"),
      idempotencyKey: "documents.fx_execute.quote:create-idem",
    });
    expect(draft.payload).toMatchObject({
      amount: "100",
      amountMinor: "10000",
      quoteSnapshot: expect.objectContaining({
        quoteId: "00000000-0000-4000-8000-000000000010",
      }),
    });
  });

  it("preserves manual percent rows when building fx_execute drafts", async () => {
    const deps = createDeps();
    const module = createFxExecuteDocumentModule(deps as any);

    const draft = await module.createDraft(
      {
        runtime: {} as any,
        now: new Date("2026-03-03T10:00:00.000Z"),
        operationIdempotencyKey: "create-idem",
      } as any,
      {
        occurredAt: new Date("2026-03-03T10:00:00.000Z"),
        sourceRequisiteId: "00000000-0000-4000-8000-000000000111",
        destinationRequisiteId: "00000000-0000-4000-8000-000000000112",
        amount: "100.00",
        memo: "desk conversion",
        financialLines: [
          {
            calcMethod: "percent",
            bucket: "fee_revenue",
            currency: "USD",
            percent: "1.25",
          },
        ],
      },
    );

    expect(draft.payload).toMatchObject({
      financialLines: [
        {
          id: "quote-line-1",
          source: "rule",
          bucket: "spread_revenue",
        },
        {
          calcMethod: "percent",
          percentBps: 125,
          source: "manual",
          bucket: "fee_revenue",
          currency: "USD",
          amountMinor: "125",
        },
      ],
    });
  });

  it("builds an immediate treasury fx posting plan and locks the quote", async () => {
    const deps = createDeps();
    const module = createFxExecuteDocumentModule(deps as any);
    const runtime = {} as any;

    const postingPlan = await module.buildPostingPlan?.(
      { runtime, now: new Date("2026-03-03T10:05:00.000Z") } as any,
      {
        id: "00000000-0000-4000-8000-000000000601",
        docType: "fx_execute",
        docNo: "FXE-1",
        occurredAt: new Date("2026-03-03T10:00:00.000Z"),
        payload: createFxExecutePayload(),
      } as any,
    );

    expect(postingPlan?.operationCode).toBe(
      OPERATION_CODE.TREASURY_FX_EXECUTE_IMMEDIATE,
    );
    expect(postingPlan?.requests[0]).toMatchObject({
      templateKey: POSTING_TEMPLATE_KEY.TREASURY_FX_SOURCE_IMMEDIATE,
      currency: "USD",
      amountMinor: 10000n,
    });
    expect(postingPlan?.requests[1]).toMatchObject({
      templateKey: POSTING_TEMPLATE_KEY.TREASURY_FX_DESTINATION_IMMEDIATE,
      currency: "EUR",
      amountMinor: 9200n,
    });
    expect(
      postingPlan?.requests.some(
        (request) =>
          request.templateKey === POSTING_TEMPLATE_KEY.TREASURY_FX_SPREAD_INCOME,
      ),
    ).toBe(true);
    expect(
      deps.quoteUsage.markQuoteUsedForFxExecute,
    ).toHaveBeenCalledWith({
      runtime,
      quoteId: "00000000-0000-4000-8000-000000000010",
      fxExecuteDocumentId: "00000000-0000-4000-8000-000000000601",
      at: new Date("2026-03-03T10:05:00.000Z"),
    });
  });

  it("settles pending treasury fx and reuses the settle accounting source", async () => {
    const module = createFxResolutionDocumentModule(createDeps() as any);
    const document = {
      id: "00000000-0000-4000-8000-000000000701",
      docType: "fx_resolution",
      docNo: "FXR-1",
      occurredAt: new Date("2026-03-04T10:00:00.000Z"),
      payload: {
        occurredAt: "2026-03-04T10:00:00.000Z",
        fxExecuteDocumentId: "00000000-0000-4000-8000-000000000601",
        resolutionType: "settle",
        eventIdempotencyKey: "evt-1",
        memo: "settle pending fx",
      },
    };

    const postingPlan = await module.buildPostingPlan?.(
      { runtime: {} } as any,
      document as any,
    );

    expect(postingPlan?.operationCode).toBe(
      OPERATION_CODE.TREASURY_FX_SETTLE_PENDING,
    );
    expect(postingPlan?.requests[0]).toMatchObject({
      templateKey: POSTING_TEMPLATE_KEY.TREASURY_FX_PENDING_SETTLE,
      pending: {
        pendingId: 101n,
        ref: "fx_execute:00000000-0000-4000-8000-000000000601:source",
        amountMinor: 10000n,
      },
    });
    expect(
      module.resolveAccountingSourceId?.(
        { runtime: {} } as any,
        document as any,
        postingPlan!,
      ),
    ).toBe(ACCOUNTING_SOURCE_ID.TREASURY_FX_RESOLUTION_SETTLE);
  });

  it("maps fail resolution to the void accounting source and dependency link", async () => {
    const module = createFxResolutionDocumentModule(createDeps() as any);
    const document = {
      id: "00000000-0000-4000-8000-000000000702",
      docType: "fx_resolution",
      docNo: "FXR-2",
      occurredAt: new Date("2026-03-04T10:00:00.000Z"),
      payload: {
        occurredAt: "2026-03-04T10:00:00.000Z",
        fxExecuteDocumentId: "00000000-0000-4000-8000-000000000601",
        resolutionType: "fail",
        eventIdempotencyKey: "evt-2",
        memo: "execution failed",
      },
    };

    const postingPlan = await module.buildPostingPlan?.(
      { runtime: {} } as any,
      document as any,
    );

    expect(postingPlan?.operationCode).toBe(
      OPERATION_CODE.TREASURY_FX_VOID_PENDING,
    );
    expect(
      module.resolveAccountingSourceId?.(
        { runtime: {} } as any,
        document as any,
        postingPlan!,
      ),
    ).toBe(ACCOUNTING_SOURCE_ID.TREASURY_FX_RESOLUTION_VOID);
    await expect(
      module.buildInitialLinks?.({ runtime: {} } as any, document as any),
    ).resolves.toEqual([
      {
        toDocumentId: "00000000-0000-4000-8000-000000000601",
        linkType: "depends_on",
      },
    ]);
  });
});
