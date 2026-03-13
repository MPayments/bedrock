import { describe, expect, it } from "vitest";

import { OPERATION_TRANSFER_TYPE } from "../src/types";
import {
  operationIntentSchema,
  validateOperationIntent,
} from "../src/validation";

const validInput = {
  source: { type: "payment", id: "src-1" },
  operationCode: "ledger.payment",
  operationVersion: 1,
  idempotencyKey: "idem-123",
  postingDate: new Date(),
  lines: [
    {
      type: OPERATION_TRANSFER_TYPE.CREATE,
      planRef: "plan-1",
      bookId: "550e8400-e29b-41d4-a716-446655440000",
      postingCode: "payment.settled",
      debit: {
        accountNo: "1000",
        currency: "USD",
        dimensions: {},
      },
      credit: {
        accountNo: "2000",
        currency: "USD",
        dimensions: {},
      },
      amountMinor: 1n,
    },
  ],
};

describe("validateOperationIntent", () => {
  it("accepts valid input", () => {
    const parsed = validateOperationIntent(validInput);
    expect(parsed.operationCode).toBe("ledger.payment");
    expect(parsed.lines).toHaveLength(1);
  });

  it("normalizes transfer currency to uppercase", () => {
    const parsed = validateOperationIntent({
      ...validInput,
      lines: [
        {
          ...validInput.lines[0],
          debit: { accountNo: "1000", currency: "usd", dimensions: {} },
          credit: { accountNo: "2000", currency: "usd", dimensions: {} },
        },
      ],
    });

    expect(parsed.lines[0]!.debit.currency).toBe("USD");
    expect(parsed.lines[0]!.credit.currency).toBe("USD");
  });

  it("accepts generic account identifiers", () => {
    const parsed = validateOperationIntent({
      ...validInput,
      lines: [
        {
          ...validInput.lines[0],
          debit: { accountNo: "cash.main", currency: "USD", dimensions: {} },
          credit: {
            accountNo: "wallet.customer",
            currency: "USD",
            dimensions: {},
          },
        },
      ],
    });

    expect(parsed.lines[0]!.type).toBe(OPERATION_TRANSFER_TYPE.CREATE);
    if (parsed.lines[0]!.type === OPERATION_TRANSFER_TYPE.CREATE) {
      expect(parsed.lines[0]!.debit.accountNo).toBe("cash.main");
      expect(parsed.lines[0]!.credit.accountNo).toBe("wallet.customer");
    }
  });

  it("rejects empty lines", () => {
    expect(() =>
      validateOperationIntent({
        ...validInput,
        lines: [],
      }),
    ).toThrow(/lines must be a non-empty array/);
  });

  it("rejects invalid source.type", () => {
    expect(() =>
      validateOperationIntent({
        ...validInput,
        source: { type: "", id: "src-1" },
      }),
    ).toThrow();
  });

  it("rejects invalid planRef", () => {
    expect(() =>
      validateOperationIntent({
        ...validInput,
        lines: [
          {
            ...validInput.lines[0],
            planRef: "",
          },
        ],
      }),
    ).toThrow();
  });

  it("exposes schema for direct parsing", () => {
    const result = operationIntentSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });
});
