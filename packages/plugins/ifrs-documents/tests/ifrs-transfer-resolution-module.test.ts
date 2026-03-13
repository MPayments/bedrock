import { describe, expect, it, vi } from "vitest";

import {
  ACCOUNTING_SOURCE_ID,
  OPERATION_CODE,
  POSTING_TEMPLATE_KEY,
} from "@bedrock/accounting/posting-contracts";
import { DocumentValidationError } from "@bedrock/documents";

import { createTransferResolutionDocumentModule } from "../src/documents/transfer-resolution";

function createDeps() {
  return {
    requisitesService: {
      resolveBindings: vi.fn(async () => [
        {
          requisiteId: "00000000-0000-4000-8000-000000000111",
          bookId: "00000000-0000-4000-8000-000000000211",
          organizationId: "00000000-0000-4000-8000-000000000311",
          currencyCode: "USD",
          postingAccountNo: "1010",
          bookAccountInstanceId: "00000000-0000-4000-8000-000000000411",
        },
        {
          requisiteId: "00000000-0000-4000-8000-000000000112",
          bookId: "00000000-0000-4000-8000-000000000212",
          organizationId: "00000000-0000-4000-8000-000000000311",
          currencyCode: "USD",
          postingAccountNo: "1010",
          bookAccountInstanceId: "00000000-0000-4000-8000-000000000412",
        },
      ]),
      findById: vi.fn(async () => ({
        id: "00000000-0000-4000-8000-000000000111",
        ownerType: "organization" as const,
        ownerId: "00000000-0000-4000-8000-000000000311",
      })),
    },
    transferLookup: {
      resolveTransferDependencyDocument: vi.fn(async () => ({
        id: "00000000-0000-4000-8000-000000000501",
        docType: "transfer_intra",
        occurredAt: new Date("2026-03-01T10:00:00.000Z"),
        payload: {
          occurredAt: "2026-03-01T10:00:00.000Z",
          organizationId: "00000000-0000-4000-8000-000000000311",
          sourceRequisiteId: "00000000-0000-4000-8000-000000000111",
          destinationRequisiteId: "00000000-0000-4000-8000-000000000112",
          timeoutSeconds: 300,
          currency: "USD",
          amountMinor: "150",
          memo: "pending transfer",
        },
      })),
      listPendingTransfers: vi.fn(async () => [
        {
          transferId: 99n,
          pendingRef: "pending-99:source",
          amountMinor: 150n,
        },
      ]),
    },
  };
}

function createResolutionDocument(
  overrides: Partial<Record<string, unknown>> = {},
) {
  return {
    id: "00000000-0000-4000-8000-000000000601",
    docType: "transfer_resolution",
    docNo: "TR-1",
    payloadVersion: 1,
    occurredAt: new Date("2026-03-02T10:00:00.000Z"),
    payload: {
      occurredAt: "2026-03-02T10:00:00.000Z",
      transferDocumentId: "00000000-0000-4000-8000-000000000501",
      resolutionType: "settle",
      eventIdempotencyKey: "evt-1",
      pendingIndex: 0,
      memo: "resolve pending",
      ...overrides,
    },
  };
}

describe("transfer resolution module", () => {
  it("builds a settle posting plan from the selected pending transfer", async () => {
    const module = createTransferResolutionDocumentModule(createDeps() as any);
    const document = createResolutionDocument();

    const postingPlan = await module.buildPostingPlan?.(
      { db: {} } as any,
      document as any,
    );

    expect(postingPlan).toEqual({
      operationCode: OPERATION_CODE.TRANSFER_SETTLE_PENDING,
      operationVersion: 1,
      payload: expect.objectContaining({
        resolutionType: "settle",
        transferDocumentId: "00000000-0000-4000-8000-000000000501",
        memo: "resolve pending",
      }),
      requests: [
        expect.objectContaining({
          templateKey: POSTING_TEMPLATE_KEY.TRANSFER_PENDING_SETTLE,
          currency: "USD",
          amountMinor: 150n,
          bookRefs: {
            bookId: "00000000-0000-4000-8000-000000000211",
          },
          pending: {
            pendingId: 99n,
            ref: "pending-99:source",
            amountMinor: 150n,
          },
        }),
      ],
    });
    expect(
      module.resolveAccountingSourceId?.(
        { db: {} } as any,
        document as any,
        postingPlan!,
      ),
    ).toBe(ACCOUNTING_SOURCE_ID.TRANSFER_RESOLUTION_SETTLE);
  });

  it("rejects posting plans when the requested pending index is out of range", async () => {
    const module = createTransferResolutionDocumentModule(createDeps() as any);

    await expect(
      module.buildPostingPlan?.(
        { db: {} } as any,
        createResolutionDocument({ pendingIndex: 4 }) as any,
      ),
    ).rejects.toThrow("Pending transfer index 4 is out of range");
  });

  it("links transfer resolutions back to their dependency document", async () => {
    const module = createTransferResolutionDocumentModule(createDeps() as any);

    await expect(
      module.buildInitialLinks?.(
        { db: {} } as any,
        createResolutionDocument() as any,
      ),
    ).resolves.toEqual([
      {
        toDocumentId: "00000000-0000-4000-8000-000000000501",
        linkType: "depends_on",
      },
    ]);
  });
});
