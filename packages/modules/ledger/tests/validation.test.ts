import { describe, expect, it } from "vitest";

import { ListLedgerOperationsInputSchema } from "../src/contracts";
import { OPERATION_TRANSFER_TYPE } from "../src/contracts";
import { OperationIntentSchema } from "../src/contracts";

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

describe("validate Operation Intent", () => {
  it("accepts valid input", () => {
    const parsed = OperationIntentSchema.parse(validInput);
    expect(parsed.operationCode).toBe("ledger.payment");
    expect(parsed.operationVersion).toBe(1);
    expect(parsed.lines).toHaveLength(1);
  });

  it("defaults operationVersion when omitted", () => {
    const { operationVersion: _, ...input } = validInput;

    const parsed = OperationIntentSchema.parse(input);

    expect(parsed.operationVersion).toBe(1);
  });

  it("normalizes transfer currency to uppercase", () => {
    const parsed = OperationIntentSchema.parse({
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
    const parsed = OperationIntentSchema.parse({
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
      OperationIntentSchema.parse({
        ...validInput,
        lines: [],
      }),
    ).toThrow(/lines must be a non-empty array/);
  });

  it("rejects invalid source.type", () => {
    expect(() =>
      OperationIntentSchema.parse({
        ...validInput,
        source: { type: "", id: "src-1" },
      }),
    ).toThrow();
  });

  it("rejects invalid planRef", () => {
    expect(() =>
      OperationIntentSchema.parse({
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
    const result = OperationIntentSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("rejects explicit undefined for exact-optional fields", () => {
    const result = OperationIntentSchema.safeParse({
      ...validInput,
      lines: [
        {
          ...validInput.lines[0],
          pending: undefined,
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});

describe("ListLedgerOperationsInputSchema", () => {
  it("rejects explicit undefined filters", () => {
    const result = ListLedgerOperationsInputSchema.safeParse({
      query: undefined,
    });

    expect(result.success).toBe(false);
  });
});
