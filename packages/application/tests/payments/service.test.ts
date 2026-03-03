import { describe, expect, it, vi } from "vitest";

import { createPaymentsService } from "../../src/payments/service";

function createDeps() {
  const documents = {
    createDraft: vi.fn(async (input) => input),
    list: vi.fn(async () => []),
    get: vi.fn(),
    getDetails: vi.fn(),
    transition: vi.fn(),
  } as const;

  const connectors = {
    createIntentFromDocument: vi.fn(),
    getIntentByDocumentId: vi.fn(),
    listAttempts: vi.fn(),
    listEvents: vi.fn(),
    enqueueAttempt: vi.fn(),
  } as const;

  const orchestration = {
    selectNextProviderForIntent: vi.fn(),
  } as const;

  return {
    db: {} as any,
    documents,
    connectors,
    orchestration,
  };
}

describe("payments service", () => {
  it("delegates createDraft to documents with payment_intent docType", async () => {
    const deps = createDeps();
    const service = createPaymentsService(deps);

    await service.createDraft({
      payload: {
        direction: "payin",
        sourceCounterpartyAccountId: "00000000-0000-4000-8000-000000000001",
        destinationCounterpartyAccountId:
          "00000000-0000-4000-8000-000000000002",
        amountMinor: 100n,
        currency: "USD",
        corridor: "default",
        occurredAt: new Date("2026-03-01T00:00:00.000Z"),
      },
      createIdempotencyKey: "create-1",
      actorUserId: "user-1",
    });

    expect(deps.documents.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        docType: "payment_intent",
        createIdempotencyKey: "create-1",
        actorUserId: "user-1",
      }),
    );
  });

  it("routes list(kind=all) to payment intent and resolution doc types", async () => {
    const deps = createDeps();
    const service = createPaymentsService(deps);

    await service.list({ kind: "all", limit: 10, offset: 2 });

    expect(deps.documents.list).toHaveBeenCalledWith({
      docType: ["payment_intent", "payment_resolution"],
      limit: 10,
      offset: 2,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
  });
});
