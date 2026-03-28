import { describe, expect, it, vi } from "vitest";

import { createTreasuryArtifactWorkflow } from "../../src/composition/treasury-artifact-workflow";

describe("createTreasuryArtifactWorkflow", () => {
  it("creates a payment_order artifact from payout treasury state", async () => {
    const createDraft = vi.fn().mockResolvedValue({
      allowedActions: [],
      document: {
        id: "88888888-8888-4888-8888-888888888888",
        docType: "payment_order",
        docNo: "PPO-1",
        title: "Платежное поручение / Payment Order",
        occurredAt: new Date("2026-03-27T10:05:00.000Z"),
        createdAt: new Date("2026-03-27T10:05:00.000Z"),
        payload: {},
      },
      postingOperationId: null,
    });
    const insertDocumentLinks = vi.fn().mockResolvedValue(undefined);
    const workflow = createTreasuryArtifactWorkflow({
      createDocumentsModule: () =>
        ({
          documents: {
            commands: {
              createDraft,
            },
          },
        }) as any,
      createTreasuryArtifactsRepository: () =>
        ({
          insertDocumentLinks,
        }) as any,
      currenciesService: {
        findById: vi.fn().mockResolvedValue({
          code: "USD",
          id: "asset-usd",
        }),
      },
      db: {
        transaction: async (handler: (tx: unknown) => Promise<unknown>) =>
          handler({}),
      } as any,
      documentsModule: {
        documents: {
          queries: {
            listByIds: vi.fn().mockResolvedValue([
              {
                allowedActions: [],
                document: {
                  id: "66666666-6666-4666-8666-666666666666",
                  docType: "incoming_invoice",
                  docNo: "IIN-1",
                  title: "Incoming invoice",
                  occurredAt: new Date("2026-03-27T09:00:00.000Z"),
                  createdAt: new Date("2026-03-27T09:00:00.000Z"),
                  payload: {
                    occurredAt: "2026-03-27T09:00:00.000Z",
                    contour: "intl",
                    customerId: "11111111-1111-4111-8111-111111111111",
                    counterpartyId: "22222222-2222-4222-8222-222222222222",
                    organizationId: "33333333-3333-4333-8333-333333333333",
                    organizationRequisiteId:
                      "44444444-4444-4444-8444-444444444444",
                    amount: "1000",
                    amountMinor: "100000",
                    currency: "USD",
                  },
                },
                postingOperationId: "posting-1",
              },
            ]),
          },
        },
      } as any,
      treasuryModule: {
        operations: {
          queries: {
            getOperationTimeline: vi.fn().mockResolvedValue({
              operation: {
                id: "operation-1",
                operationKind: "payout",
                sourceAccountId: "44444444-4444-4444-8444-444444444444",
                sourceAmountMinor: "100000",
                sourceAssetId: "asset-usd",
                executingEntityId: "33333333-3333-4333-8333-333333333333",
                memo: "Treasury payout",
              },
              instructionItems: [
                {
                  id: "instruction-1",
                  destinationEndpointId:
                    "55555555-5555-4555-8555-555555555555",
                  createdAt: new Date("2026-03-27T10:00:00.000Z"),
                },
              ],
              eventItems: [],
            }),
            listOperationDocumentLinks: vi.fn().mockResolvedValue([
              {
                documentId: "66666666-6666-4666-8666-666666666666",
                linkKind: "obligation",
              },
            ]),
          },
        },
      } as any,
    });

    const result = await workflow.createPaymentOrderArtifact({
      actorUserId: "user-1",
      operationId: "operation-1",
      requestContext: {
        requestId: "req-1",
      },
    });

    expect(createDraft).toHaveBeenCalledWith({
      actorUserId: "user-1",
      createIdempotencyKey:
        "treasury:operation:payment_order_artifact:operation-1:instruction-1",
      docType: "payment_order",
      payload: expect.objectContaining({
        contour: "intl",
        incomingInvoiceDocumentId: "66666666-6666-4666-8666-666666666666",
        counterpartyId: "22222222-2222-4222-8222-222222222222",
        counterpartyRequisiteId: "55555555-5555-4555-8555-555555555555",
        organizationId: "33333333-3333-4333-8333-333333333333",
        organizationRequisiteId: "44444444-4444-4444-8444-444444444444",
        amount: "1000",
        currency: "USD",
        allocatedCurrency: "USD",
        executionStatus: "prepared",
        memo: "Treasury payout",
      }),
      requestContext: {
        requestId: "req-1",
      },
    });
    expect(insertDocumentLinks).toHaveBeenCalledWith([
      {
        documentId: "88888888-8888-4888-8888-888888888888",
        linkKind: "operation",
        targetId: "operation-1",
      },
      {
        documentId: "88888888-8888-4888-8888-888888888888",
        linkKind: "instruction",
        targetId: "instruction-1",
      },
    ]);
    expect(result.created).toBe(true);
    expect(result.linkKinds).toEqual(["operation", "instruction"]);
  });

  it("reuses an existing payment_order artifact instead of creating a duplicate", async () => {
    const createDraft = vi.fn();
    const workflow = createTreasuryArtifactWorkflow({
      createDocumentsModule: () =>
        ({
          documents: {
            commands: {
              createDraft,
            },
          },
        }) as any,
      currenciesService: {
        findById: vi.fn(),
      },
      db: {
        transaction: async (handler: (tx: unknown) => Promise<unknown>) =>
          handler({}),
      } as any,
      documentsModule: {
        documents: {
          queries: {
            listByIds: vi.fn().mockResolvedValue([
              {
                allowedActions: [],
                document: {
                  id: "77777777-7777-4777-8777-777777777777",
                  docType: "payment_order",
                  docNo: "PPO-1",
                  title: "Платежное поручение / Payment Order",
                  occurredAt: new Date("2026-03-27T10:05:00.000Z"),
                  createdAt: new Date("2026-03-27T10:05:00.000Z"),
                  payload: {},
                },
                postingOperationId: null,
              },
            ]),
          },
        },
      } as any,
      treasuryModule: {
        operations: {
          queries: {
            getOperationTimeline: vi.fn().mockResolvedValue({
              operation: {
                id: "operation-1",
                operationKind: "payout",
              },
              instructionItems: [],
              eventItems: [],
            }),
            listOperationDocumentLinks: vi.fn().mockResolvedValue([
              {
                documentId: "77777777-7777-4777-8777-777777777777",
                linkKind: "operation",
              },
            ]),
          },
        },
      } as any,
    });

    const result = await workflow.createPaymentOrderArtifact({
      actorUserId: "user-1",
      operationId: "operation-1",
    });

    expect(createDraft).not.toHaveBeenCalled();
    expect(result.created).toBe(false);
    expect(result.artifact.document.docType).toBe("payment_order");
    expect(result.linkKinds).toEqual(["operation"]);
  });
});
