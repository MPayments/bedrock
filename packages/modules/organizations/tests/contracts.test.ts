import { describe, expect, it } from "vitest";

import {
  CountryCodeSchema,
  CreateOrganizationInputSchema,
  OrganizationOptionSchema,
  PartyKindSchema,
  UpdateOrganizationInputSchema,
} from "../src/contracts";

describe("organizations contracts", () => {
  it("normalizes country codes for create input", () => {
    const parsed = CreateOrganizationInputSchema.parse({
      shortName: "  Test Org  ",
      fullName: "  Test Organization LLC  ",
      country: "us",
      externalId: "  org-1  ",
      description: "   ",
    });

    expect(parsed.country).toBe("US");
    expect(parsed.kind).toBe("legal_entity");
    expect(parsed.shortName).toBe("Test Org");
    expect(parsed.fullName).toBe("Test Organization LLC");
    expect(parsed.externalId).toBe("org-1");
    expect(parsed.description).toBeNull();
  });

  it("rejects explicit undefined in organization update input", () => {
    expect(
      UpdateOrganizationInputSchema.safeParse({ shortName: undefined }).success,
    ).toBe(false);
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
