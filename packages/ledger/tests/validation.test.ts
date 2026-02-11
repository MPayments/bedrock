import { describe, it, expect, vi } from "vitest";
import { PlanType } from "../src/types";
import { createEntryInputSchema, validateCreateEntryInput } from "../src/validation";

describe("validateCreateEntryInput", () => {
  const validInput = {
    orgId: "550e8400-e29b-41d4-a716-446655440000",
    source: { type: "payment", id: "src-1" },
    idempotencyKey: "idem-123",
    postingDate: new Date(),
    transfers: [
      {
        type: PlanType.CREATE,
        planKey: "plan-1",
        debitKey: "customer:1",
        creditKey: "revenue:sales",
        currency: "USD",
        amount: 1n,
      },
    ],
  };

  it("formats orgId errors with a helpful message", () => {
    expect(() =>
      validateCreateEntryInput({
        ...validInput,
        orgId: "not-a-uuid",
      })
    ).toThrow(/orgId must be a valid UUID/);
  });

  it("falls back to path-based error messages for unknown paths", () => {
    expect(() =>
      validateCreateEntryInput({
        ...validInput,
        source: { type: "", id: "src-1" },
      })
    ).toThrow(/source\.type:/);
  });

  it("handles zod errors with no issues array", () => {
    const spy = vi.spyOn(createEntryInputSchema, "safeParse").mockReturnValueOnce({
      success: false,
      error: { issues: [], message: "boom" },
    } as any);

    expect(() => validateCreateEntryInput(validInput)).toThrow(/Validation failed: boom/);
    spy.mockRestore();
  });
});
