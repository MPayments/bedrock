import { describe, expect, it } from "vitest";

import {
  CreateRequisiteProviderInputSchema,
  UpdateRequisiteProviderInputSchema,
} from "../src/contracts";

describe("requisite provider contracts", () => {
  it("normalizes optional create fields into concrete nulls", () => {
    const parsed = CreateRequisiteProviderInputSchema.parse({
      kind: "bank",
      name: "  Core Bank  ",
      country: "ru",
      description: "   ",
      bic: " 044525225 ",
    });

    expect(parsed.name).toBe("Core Bank");
    expect(parsed.country).toBe("RU");
    expect(parsed.description).toBeNull();
    expect(parsed.address).toBeNull();
    expect(parsed.contact).toBeNull();
    expect(parsed.swift).toBeNull();
    expect(parsed.bic).toBe("044525225");
  });

  it("requires swift for non-Russian bank providers", () => {
    expect(() =>
      CreateRequisiteProviderInputSchema.parse({
        kind: "bank",
        name: "Core Bank",
        country: "US",
      }),
    ).toThrow(/swift is required for non-Russian banks/);
  });

  it("rejects explicit undefined in update input", () => {
    expect(
      UpdateRequisiteProviderInputSchema.safeParse({ name: undefined }).success,
    ).toBe(false);
  });
});
