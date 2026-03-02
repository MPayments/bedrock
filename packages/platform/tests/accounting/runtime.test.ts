import { describe, expect, it } from "vitest";

import { POSTING_TEMPLATE_KEY } from "@bedrock/foundation/accounting-contracts";
import { rawPackDefinition } from "@bedrock/foundation/packs/bedrock-core-default";

import {
  createAccountingRuntime,
  type DocumentPostingPlan,
} from "../../src/accounting/runtime";

describe("accounting runtime", () => {
  const runtime = createAccountingRuntime({
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
            sourceOperationalAccountId: "src-op",
            destinationOperationalAccountId: "dst-op",
          },
          refs: {
            transferDocumentId: "doc-1",
          },
          memo: "move funds",
        },
      ],
    };

    const result = await runtime.resolvePostingPlan({
      accountingSourceId: "transfer",
      source: { type: "documents/transfer/post", id: "doc-1" },
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
            operationalAccountId: "dst-op",
          },
        },
        credit: {
          accountNo: "1110",
          currency: "USD",
          dimensions: {
            operationalAccountId: "src-op",
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
      runtime.resolvePostingPlan({
        accountingSourceId: "external_funding",
        source: { type: "documents/transfer/post", id: "doc-1" },
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
                sourceOperationalAccountId: "src-op",
                destinationOperationalAccountId: "dst-op",
              },
            },
          ],
        },
      }),
    ).rejects.toThrow(/is not allowed to use template/);
  });

  it("rejects posting plans without a concrete book id", async () => {
    await expect(
      runtime.resolvePostingPlan({
        accountingSourceId: "transfer",
        source: { type: "documents/transfer/post", id: "doc-1" },
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
                sourceOperationalAccountId: "src-op",
                destinationOperationalAccountId: "dst-op",
              },
            },
          ],
        },
      }),
    ).rejects.toThrow(/bookRefs\.bookId/);
  });
});
