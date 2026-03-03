import { describe, expect, it } from "vitest";

import {
  PaymentIntentInputSchema,
  PaymentIntentPayloadSchema,
} from "../../src/payments/validation";

describe("payments validation", () => {
  it("accepts API amount and converts it to amountMinor", () => {
    const parsed = PaymentIntentInputSchema.parse({
      direction: "payin",
      sourceCounterpartyAccountId: "00000000-0000-4000-8000-000000000001",
      destinationCounterpartyAccountId: "00000000-0000-4000-8000-000000000002",
      amount: "10.25",
      currency: "usd",
      corridor: "default",
      occurredAt: "2026-03-03T10:00:00.000Z",
    });

    expect(parsed.currency).toBe("USD");
    expect(parsed.amountMinor).toBe(1025n);
    expect("amount" in parsed).toBe(false);
  });

  it("keeps payload parsing compatible with stored amountMinor", () => {
    const parsed = PaymentIntentPayloadSchema.parse({
      direction: "payin",
      sourceCounterpartyAccountId: "00000000-0000-4000-8000-000000000001",
      destinationCounterpartyAccountId: "00000000-0000-4000-8000-000000000002",
      amountMinor: "100",
      currency: "USD",
      corridor: "default",
      occurredAt: "2026-03-03T10:00:00.000Z",
    });

    expect(parsed.amountMinor).toBe(100n);
  });
});
