import { describe, expect, it } from "vitest";

import {
  CommercialRouteFeeKindSchema,
  CommercialRouteFeeSchema,
} from "../src/application/contracts/payment-route-fee";

describe("commercial route fee contracts", () => {
  it("accepts valid percent and fixed fee shapes", () => {
    expect(CommercialRouteFeeKindSchema.options).toEqual(["percent", "fixed"]);

    expect(
      CommercialRouteFeeSchema.parse({
        id: "fee-percent",
        kind: "percent",
        percentage: "2.5",
      }),
    ).toMatchObject({
      id: "fee-percent",
      kind: "percent",
      percentage: "2.5",
    });

    expect(
      CommercialRouteFeeSchema.parse({
        amountMinor: "100",
        currencyId: "00000000-0000-4000-8000-000000000001",
        id: "fee-fixed",
        kind: "fixed",
      }),
    ).toMatchObject({
      amountMinor: "100",
      kind: "fixed",
    });
  });

  it("rejects mixed percent and fixed fields", () => {
    expect(() =>
      CommercialRouteFeeSchema.parse({
        amountMinor: "100",
        currencyId: "00000000-0000-4000-8000-000000000001",
        id: "fee-percent-invalid",
        kind: "percent",
        percentage: "10",
      }),
    ).toThrow("Percent fee cannot define amountMinor");

    expect(() =>
      CommercialRouteFeeSchema.parse({
        amountMinor: "100",
        currencyId: "00000000-0000-4000-8000-000000000001",
        id: "fee-fixed-invalid",
        kind: "fixed",
        percentage: "1",
      }),
    ).toThrow("Fixed fee cannot define percentage");
  });
});
