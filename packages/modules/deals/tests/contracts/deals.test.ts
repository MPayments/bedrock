import { describe, expect, it } from "vitest";

import {
  DealTypeSchema,
  DealLegOperationKindSchema,
  RequestDealExecutionInputSchema,
  UpdateDealCommentInputSchema,
} from "../../src/contracts";

describe("deals contracts", () => {
  it("trims nullable deal comment updates", () => {
    const parsed = UpdateDealCommentInputSchema.parse({
      comment: "  test  ",
    });

    expect(parsed.comment).toBe("test");
  });

  it("accepts reserved canonical deal types in the enum", () => {
    expect(DealTypeSchema.safeParse("currency_exchange").success).toBe(true);
    expect(DealTypeSchema.safeParse("currency_transit").success).toBe(true);
    expect(DealTypeSchema.safeParse("exporter_settlement").success).toBe(true);
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
