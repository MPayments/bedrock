import { describe, expect, it } from "vitest";

import { validateReserveBalanceInput } from "../src/validation";

describe("balances validation", () => {
  it("rejects non-positive reserve amounts", () => {
    expect(() =>
      validateReserveBalanceInput({
        subject: {
          bookId: "book-1",
          subjectType: "customer",
          subjectId: "cust-1",
          currency: "USD",
        },
        amountMinor: 0n,
        holdRef: "hold-1",
      }),
    ).toThrow();
  });
});
