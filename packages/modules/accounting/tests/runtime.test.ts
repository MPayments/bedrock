import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { rawPackDefinition } from "@bedrock/accounting/packs/bedrock-core-default";
import { POSTING_TEMPLATE_KEY } from "@bedrock/accounting/posting-contracts";
import { noopLogger } from "@bedrock/platform/observability/logger";

import { createPacksService, type DocumentPostingPlan } from "../src/packs/application";

describe("accounting packs service", () => {
  const packsService = createPacksService({
    runtime: {
      log: noopLogger,
      now: () => new Date(),
      generateUuid: randomUUID,
      service: "accounting.packs.test",
    },
    commandUow: {
      run: (work) =>
        work({
          packs: {
            findVersion: async () => null,
            insertVersion: async () => undefined,
            updateVersion: async () => undefined,
            hasAssignmentsForChecksum: async () => false,
            insertAssignment: async () => undefined,
          },
        }),
    },
    defaultPackDefinition: rawPackDefinition,
  });

  it("resolves compiled transfer plan into journal intent", async () => {
    const plan: DocumentPostingPlan = {
      operationCode: "TRANSFER_APPROVE_IMMEDIATE_INTRA",
      operationVersion: 1,
      payload: { transferId: "doc-1" },
      requests: [
        {
          templateKey: POSTING_TEMPLATE_KEY.TRANSFER_INTRA_IMMEDIATE,
          effectiveAt: new Date("2026-02-28T10:00:00.000Z"),
          currency: "USD",
          amountMinor: 1250n,
          bookRefs: {
            bookId: "00000000-0000-4000-8000-000000000001",
          },
          dimensions: {
            sourceRequisiteId: "src-op",
            destinationRequisiteId: "dst-op",
          },
          refs: {
            transferDocumentId: "doc-1",
          },
          memo: "move funds",
        },
      ],
    };

    const result = await packsService.queries.resolvePostingPlan({
      accountingSourceId: "transfer_intra",
      source: { type: "documents/transfer_intra/post", id: "doc-1" },
      idempotencyKey: "post:doc-1",
      postingDate: new Date("2026-02-28T10:00:00.000Z"),
      plan,
    });

    expect(result.packChecksum).toBeTypeOf("string");
    expect(result.postingPlanChecksum).toBeTypeOf("string");
    expect(result.journalIntentChecksum).toBeTypeOf("string");
    expect(result.appliedTemplates).toEqual([
      {
        requestIndex: 0,
        templateKey: POSTING_TEMPLATE_KEY.TRANSFER_INTRA_IMMEDIATE,
        lineType: "create",
        postingCode: "TR.INTRA.IMMEDIATE",
      },
    ]);
    expect(result.intent.lines).toEqual([
      {
        type: "create",
        planRef: expect.any(String),
        bookId: "00000000-0000-4000-8000-000000000001",
        postingCode: "TR.INTRA.IMMEDIATE",
        debit: {
          accountNo: "1110",
          currency: "USD",
          dimensions: {
            organizationRequisiteId: "dst-op",
          },
        },
        credit: {
          accountNo: "1110",
          currency: "USD",
          dimensions: {
            organizationRequisiteId: "src-op",
          },
        },
        amountMinor: 1250n,
        code: 4001,
        memo: "move funds",
        chain: null,
      },
    ]);
  });

  it("rejects template usage outside its allowlist", async () => {
    await expect(
      packsService.queries.resolvePostingPlan({
        accountingSourceId: "capital_funding",
        source: { type: "documents/capital_funding/post", id: "doc-1" },
        idempotencyKey: "post:doc-1",
        postingDate: new Date("2026-02-28T10:00:00.000Z"),
        plan: {
          operationCode: "TRANSFER_APPROVE_IMMEDIATE_INTRA",
          operationVersion: 1,
          payload: {},
          requests: [
            {
              templateKey: POSTING_TEMPLATE_KEY.TRANSFER_INTRA_IMMEDIATE,
              effectiveAt: new Date("2026-02-28T10:00:00.000Z"),
              currency: "USD",
              amountMinor: 100n,
              bookRefs: {
                bookId: "00000000-0000-4000-8000-000000000001",
              },
              dimensions: {
                sourceRequisiteId: "src-op",
                destinationRequisiteId: "dst-op",
              },
            },
          ],
        },
      }),
    ).rejects.toThrow(/is not allowed to use template/);
  });

  it("resolves reserve-release templates for exchange finalization", async () => {
    const result = await packsService.queries.resolvePostingPlan({
      accountingSourceId: "fx_execute",
      source: { type: "documents/exchange/post", id: "doc-2" },
      idempotencyKey: "post:doc-2",
      postingDate: new Date("2026-03-03T10:05:00.000Z"),
      plan: {
        operationCode: "TREASURY_FX_EXECUTED",
        operationVersion: 1,
        payload: { exchangeId: "doc-2" },
        requests: [
          {
            templateKey:
              POSTING_TEMPLATE_KEY.PAYMENT_FX_FEE_INCOME_FROM_RESERVE,
            effectiveAt: new Date("2026-03-03T10:05:00.000Z"),
            currency: "USD",
            amountMinor: 250n,
            bookRefs: {
              bookId: "00000000-0000-4000-8000-000000000001",
            },
            dimensions: {
              orderId: "order-1",
              feeBucket: "fee_revenue",
            },
            refs: {
              quoteRef: "quote-ref-1",
              chainId: "invoice:order-1",
              componentId: "line-1",
              componentIndex: "1",
            },
          },
        ],
      },
    });

    expect(result.appliedTemplates).toEqual([
      {
        requestIndex: 0,
        templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_FEE_INCOME_FROM_RESERVE,
        lineType: "create",
        postingCode: "TC.3004",
      },
    ]);
    expect(result.intent.lines).toEqual([
      expect.objectContaining({
        type: "create",
        planRef: expect.any(String),
        bookId: "00000000-0000-4000-8000-000000000001",
        postingCode: "TC.3004",
        debit: {
          accountNo: "2120",
          currency: "USD",
          dimensions: {
            orderId: "order-1",
            feeBucket: "fee_revenue",
          },
        },
        credit: {
          accountNo: "4110",
          currency: "USD",
          dimensions: {
            orderId: "order-1",
            feeBucket: "fee_revenue",
          },
        },
        amountMinor: 250n,
        code: 3004,
        memo: null,
        chain: "invoice:order-1",
      }),
    ]);
  });

  it("allows invoice reserve plans to reserve customer charges into fee clearing", async () => {
    const result = await packsService.queries.resolvePostingPlan({
      accountingSourceId: "invoice_reserve",
      source: { type: "documents/invoice/post", id: "doc-3" },
      idempotencyKey: "post:doc-3",
      postingDate: new Date("2026-03-03T10:00:00.000Z"),
      plan: {
        operationCode: "COMMERCIAL_INVOICE_RESERVE",
        operationVersion: 1,
        payload: { invoiceId: "doc-3" },
        requests: [
          {
            templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_FEE_RESERVE,
            effectiveAt: new Date("2026-03-03T10:00:00.000Z"),
            currency: "USD",
            amountMinor: 150n,
            bookRefs: {
              bookId: "00000000-0000-4000-8000-000000000001",
            },
            dimensions: {
              customerId: "customer-1",
              orderId: "order-1",
              feeBucket: "fee_revenue",
            },
            refs: {
              quoteRef: "quote-ref-1",
              chainId: "invoice:order-1",
              componentId: "line-1",
              componentIndex: "1",
            },
          },
        ],
      },
    });

    expect(result.appliedTemplates).toEqual([
      {
        requestIndex: 0,
        templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_FEE_RESERVE,
        lineType: "create",
        postingCode: "TC.3003",
      },
    ]);
  });

  it("omits absent pending config from direct invoice intent lines", async () => {
    const result = await packsService.queries.resolvePostingPlan({
      accountingSourceId: "invoice_direct",
      source: { type: "documents/invoice/post", id: "doc-direct" },
      idempotencyKey: "post:doc-direct",
      postingDate: new Date("2026-03-03T10:00:00.000Z"),
      plan: {
        operationCode: "COMMERCIAL_INVOICE_DIRECT",
        operationVersion: 1,
        payload: { invoiceId: "doc-direct" },
        requests: [
          {
            templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_PRINCIPAL,
            effectiveAt: new Date("2026-03-03T10:00:00.000Z"),
            currency: "USD",
            amountMinor: 321_210n,
            bookRefs: {
              bookId: "00000000-0000-4000-8000-000000000001",
            },
            dimensions: {
              customerId: "customer-1",
              orderId: "order-1",
            },
            refs: {
              quoteRef: "invoice:order-1",
              chainId: "invoice:order-1",
            },
          },
          {
            templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_PAYOUT_OBLIGATION,
            effectiveAt: new Date("2026-03-03T10:00:00.000Z"),
            currency: "USD",
            amountMinor: 321_210n,
            bookRefs: {
              bookId: "00000000-0000-4000-8000-000000000001",
            },
            dimensions: {
              orderId: "order-1",
            },
            refs: {
              quoteRef: "invoice:order-1",
              chainId: "invoice:order-1",
              payoutCounterpartyId: "counterparty-1",
            },
          },
        ],
      },
    });

    expect(result.intent.lines).toHaveLength(2);
    for (const line of result.intent.lines) {
      expect("pending" in line).toBe(false);
    }
  });

  it("omits absent transfer code from pending settlement lines", async () => {
    const result = await packsService.queries.resolvePostingPlan({
      accountingSourceId: "payout_settle",
      source: { type: "documents/payout/post", id: "doc-pending" },
      idempotencyKey: "post:doc-pending",
      postingDate: new Date("2026-03-03T10:00:00.000Z"),
      plan: {
        operationCode: "TREASURY_PAYOUT_SETTLE",
        operationVersion: 1,
        payload: { payoutId: "doc-pending" },
        requests: [
          {
            templateKey: POSTING_TEMPLATE_KEY.PAYMENT_PAYOUT_SETTLE,
            effectiveAt: new Date("2026-03-03T10:00:00.000Z"),
            currency: "USD",
            amountMinor: 1n,
            bookRefs: {
              bookId: "00000000-0000-4000-8000-000000000001",
            },
            dimensions: {},
            refs: {
              orderId: "order-1",
              railRef: "rail-1",
            },
            pending: {
              pendingId: 42n,
            },
          },
        ],
      },
    });

    expect(result.intent.lines).toEqual([
      expect.objectContaining({
        type: "post_pending",
        pendingId: 42n,
        amount: 0n,
      }),
    ]);
    expect("code" in result.intent.lines[0]!).toBe(false);
  });

  it("resolves treasury fx source postings into clearing and bank dimensions", async () => {
    const result = await packsService.queries.resolvePostingPlan({
      accountingSourceId: "treasury_fx_execute",
      source: { type: "documents/fx_execute/post", id: "doc-4" },
      idempotencyKey: "post:doc-4",
      postingDate: new Date("2026-03-03T10:00:00.000Z"),
      plan: {
        operationCode: "TREASURY_FX_EXECUTE_IMMEDIATE",
        operationVersion: 1,
        payload: { fxExecuteId: "doc-4" },
        requests: [
          {
            templateKey: POSTING_TEMPLATE_KEY.TREASURY_FX_SOURCE_IMMEDIATE,
            effectiveAt: new Date("2026-03-03T10:00:00.000Z"),
            currency: "USD",
            amountMinor: 10_000n,
            bookRefs: {
              bookId: "00000000-0000-4000-8000-000000000001",
            },
            dimensions: {
              sourceRequisiteId: "src-op",
              destinationRequisiteId: "dst-op",
              sourceOrganizationId: "org-src",
              destinationOrganizationId: "org-dst",
            },
            refs: {
              fxExecuteDocumentId: "doc-4",
              quoteRef: "quote-ref-1",
              chainId: "fx_execute:doc-4",
            },
          },
        ],
      },
    });

    expect(result.appliedTemplates).toEqual([
      {
        requestIndex: 0,
        templateKey: POSTING_TEMPLATE_KEY.TREASURY_FX_SOURCE_IMMEDIATE,
        lineType: "create",
        postingCode: "TC.2101",
      },
    ]);
    expect(result.intent.lines).toEqual([
      {
        type: "create",
        planRef: expect.any(String),
        bookId: "00000000-0000-4000-8000-000000000001",
        postingCode: "TC.2101",
        debit: {
          accountNo: "1310",
          currency: "USD",
          dimensions: {
            clearingKind: "treasury_fx",
            orderId: "doc-4",
          },
        },
        credit: {
          accountNo: "1110",
          currency: "USD",
          dimensions: {
            organizationRequisiteId: "src-op",
          },
        },
        amountMinor: 10_000n,
        code: 2101,
        memo: null,
        chain: "fx_execute:doc-4",
      },
    ]);
  });

  it("rejects posting plans without a concrete book id", async () => {
    await expect(
      packsService.queries.resolvePostingPlan({
        accountingSourceId: "transfer_intra",
        source: { type: "documents/transfer_intra/post", id: "doc-1" },
        idempotencyKey: "post:doc-1",
        postingDate: new Date("2026-02-28T10:00:00.000Z"),
        plan: {
          operationCode: "TRANSFER_APPROVE_IMMEDIATE_INTRA",
          operationVersion: 1,
          payload: {},
          requests: [
            {
              templateKey: POSTING_TEMPLATE_KEY.TRANSFER_INTRA_IMMEDIATE,
              effectiveAt: new Date("2026-02-28T10:00:00.000Z"),
              currency: "USD",
              amountMinor: 100n,
              bookRefs: {},
              dimensions: {
                sourceRequisiteId: "src-op",
                destinationRequisiteId: "dst-op",
              },
            },
          ],
        },
      }),
    ).rejects.toThrow(/bookRefs\.bookId/);
  });
});
