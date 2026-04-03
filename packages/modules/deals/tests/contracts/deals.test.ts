import { describe, expect, it } from "vitest";

import {
  CreateDealInputSchema,
  DealLegOperationKindSchema,
  RequestDealExecutionInputSchema,
} from "../../src/contracts";

describe("deals contracts", () => {
  it("trims nullable comment fields on create", () => {
    const parsed = CreateDealInputSchema.parse({
      customerId: "00000000-0000-4000-8000-000000000001",
      agreementId: "00000000-0000-4000-8000-000000000002",
      calculationId: "00000000-0000-4000-8000-000000000003",
      type: "payment",
      comment: "  test  ",
    });

    expect(parsed.comment).toBe("test");
  });

  it("accepts reserved canonical deal types in the enum", () => {
    expect(
      CreateDealInputSchema.shape.type.safeParse("currency_exchange").success,
    ).toBe(true);
    expect(
      CreateDealInputSchema.shape.type.safeParse("currency_transit").success,
    ).toBe(true);
    expect(
      CreateDealInputSchema.shape.type.safeParse("exporter_settlement").success,
    ).toBe(true);
  });

  it("accepts empty or trimmed execution request comments", () => {
    expect(RequestDealExecutionInputSchema.parse({})).toEqual({
      comment: null,
    });
    expect(
      RequestDealExecutionInputSchema.parse({
        comment: "  materialize treasury ops  ",
      }),
    ).toEqual({
      comment: "materialize treasury ops",
    });
  });

  it("accepts treasury operation kinds linkable from deal legs", () => {
    expect(DealLegOperationKindSchema.safeParse("payin").success).toBe(true);
    expect(
      DealLegOperationKindSchema.safeParse("fx_conversion").success,
    ).toBe(true);
    expect(
      DealLegOperationKindSchema.safeParse("internal_treasury").success,
    ).toBe(false);
  });
});
