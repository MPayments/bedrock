import { describe, expect, it } from "vitest";

import { ReserveBalanceInputSchema } from "../src/contracts";

describe("balances validation", () => {
  const subject = {
    bookId: "00000000-0000-4000-8000-000000000001",
    subjectType: "customer",
    subjectId: "cust-1",
    currency: "USD",
  };

  it("rejects non-positive reserve amounts", () => {
    expect(() =>
      ReserveBalanceInputSchema.parse({
        subject,
        amount: "0",
        holdRef: "hold-1",
        idempotencyKey: "idem-1",
      }),
    ).toThrow();
  });

  it("converts API amount to amountMinor inside validation", () => {
    const validated = ReserveBalanceInputSchema.parse({
      subject,
      amount: "10.25",
      holdRef: "hold-2",
      idempotencyKey: "idem-2",
    });

    expect(validated.amountMinor).toBe(1025n);
  });
});
