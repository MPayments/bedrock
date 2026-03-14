import { describe, expect, it } from "vitest";

import {
  CountryCodeSchema,
  CreateOrganizationInputSchema,
  OrganizationOptionSchema,
  PartyKindSchema,
} from "../src/contracts";

describe("organizations contracts", () => {
  it("normalizes country codes for create input", () => {
    const parsed = CreateOrganizationInputSchema.parse({
      shortName: "Test Org",
      fullName: "Test Organization LLC",
      country: "us",
    });

    expect(parsed.country).toBe("US");
    expect(parsed.kind).toBe("legal_entity");
  });

  it("rejects invalid party kinds and countries", () => {
    expect(() => PartyKindSchema.parse("government")).toThrow();
    expect(() => CountryCodeSchema.parse("zzzz")).toThrow();
  });

  it("parses organization options", () => {
    expect(
      OrganizationOptionSchema.parse({
        id: "a60a5427-67d8-44ef-8a29-1f4f205b5f0b",
        shortName: "Bedrock",
        label: "Bedrock",
      }),
    ).toEqual({
      id: "a60a5427-67d8-44ef-8a29-1f4f205b5f0b",
      shortName: "Bedrock",
      label: "Bedrock",
    });
  });
});
