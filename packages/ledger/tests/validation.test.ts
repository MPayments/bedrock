import { describe, expect, it } from "vitest";

import { OPERATION_TRANSFER_TYPE } from "../src/types";
import {
  createOperationInputSchema,
  validateCreateOperationInput,
} from "../src/validation";

const validInput = {
  source: { type: "payment", id: "src-1" },
  operationCode: "ledger.payment",
  operationVersion: 1,
  idempotencyKey: "idem-123",
  postingDate: new Date(),
  transfers: [
    {
      type: OPERATION_TRANSFER_TYPE.CREATE,
      planRef: "plan-1",
      bookOrgId: "550e8400-e29b-41d4-a716-446655440000",
      debitAccountNo: "1000",
      creditAccountNo: "2000",
      postingCode: "payment.settled",
      currency: "USD",
      amount: 1n,
    },
  ],
};

describe("validateCreateOperationInput", () => {
  it("accepts valid input", () => {
    const parsed = validateCreateOperationInput(validInput);
    expect(parsed.operationCode).toBe("ledger.payment");
    expect(parsed.transfers).toHaveLength(1);
  });

  it("normalizes transfer currency to uppercase", () => {
    const parsed = validateCreateOperationInput({
      ...validInput,
      transfers: [
        {
          ...validInput.transfers[0],
          currency: "usd",
        },
      ],
    });

    expect(parsed.transfers[0]!.currency).toBe("USD");
  });

  it("rejects empty transfers", () => {
    expect(() =>
      validateCreateOperationInput({
        ...validInput,
        transfers: [],
      }),
    ).toThrow(/transfers must be a non-empty array/);
  });

  it("rejects invalid source.type", () => {
    expect(() =>
      validateCreateOperationInput({
        ...validInput,
        source: { type: "", id: "src-1" },
      }),
    ).toThrow();
  });

  it("rejects invalid planRef", () => {
    expect(() =>
      validateCreateOperationInput({
        ...validInput,
        transfers: [
          {
            ...validInput.transfers[0],
            planRef: "",
          },
        ],
      }),
    ).toThrow();
  });

  it("exposes schema for direct parsing", () => {
    const result = createOperationInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });
});
