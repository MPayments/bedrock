import { describe, expect, it } from "vitest";

import {
  CreateRequisiteProviderInputSchema,
  UpdateRequisiteProviderInputSchema,
} from "../src/contracts";

describe("requisite provider contracts", () => {
  it("requires swift for non-Russian bank providers", () => {
    expect(() =>
      CreateRequisiteProviderInputSchema.parse({
        kind: "bank",
        name: "Core Bank",
        country: "US",
      }),
    ).toThrow(/swift is required for non-Russian banks/);
  });

  it("rejects bic for blockchain providers", () => {
    expect(() =>
      UpdateRequisiteProviderInputSchema.parse({
        kind: "blockchain",
        bic: "044525225",
      }),
    ).toThrow(/bic is only allowed for bank providers/);
  });
});
