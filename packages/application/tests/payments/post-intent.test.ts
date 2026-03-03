import { describe, expect, it, vi } from "vitest";

import { postPaymentIntentWithConnectorFlow } from "../../src/payments/internal/post-intent";

describe("postPaymentIntentWithConnectorFlow", () => {
  it("uses stable idempotency keys based on document id", async () => {
    const createIntentFromDocument = vi.fn(async () => ({ id: "intent-1" }));
    const enqueueAttempt = vi.fn(async () => ({ id: "attempt-1" }));
    const selectNextProviderForIntent = vi.fn(async () => ({
      selected: {
        providerCode: "provider-1",
        degradationOrder: ["default"],
      },
    }));

    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{ bookId: "book-1" }]),
          })),
        })),
      })),
    } as any;

    await postPaymentIntentWithConnectorFlow({
      deps: {
        db,
        connectors: {
          createIntentFromDocument,
          enqueueAttempt,
        },
        orchestration: {
          selectNextProviderForIntent,
        },
        log: {
          info: vi.fn(),
        } as any,
      },
      posted: {
        document: {
          id: "11111111-1111-4111-8111-111111111111",
          docType: "payment_intent",
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
        },
        postingOperationId: "op-1",
      } as any,
      actorUserId: "user-1",
    });

    expect(createIntentFromDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey:
          "payment-intent-post:11111111-1111-4111-8111-111111111111:connector-intent",
      }),
    );
    expect(enqueueAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey:
          "payment-intent-post:11111111-1111-4111-8111-111111111111:attempt:1",
      }),
    );
  });
});
