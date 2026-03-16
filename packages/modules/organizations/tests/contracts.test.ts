import { describe, expect, it } from "vitest";

import {
  CountryCodeSchema,
  CreateOrganizationInputSchema,
  CreateOrganizationRequisiteInputSchema,
  OrganizationOptionSchema,
  PartyKindSchema,
  UpdateOrganizationInputSchema,
  UpdateOrganizationRequisiteInputSchema,
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

  it("normalizes create requisite input into concrete values", () => {
    const parsed = CreateOrganizationRequisiteInputSchema.parse({
      organizationId: "550e8400-e29b-41d4-a716-446655440001",
      providerId: "550e8400-e29b-41d4-a716-446655440002",
      currencyId: "550e8400-e29b-41d4-a716-446655440003",
      kind: "bank",
      label: "  Main bank  ",
      description: "   ",
    });

    expect(parsed.label).toBe("Main bank");
    expect(parsed.description).toBeNull();
    expect(parsed.isDefault).toBe(false);
    expect(parsed.accountNo).toBeNull();
  });

  it("rejects explicit undefined in organization requisite update input", () => {
    expect(
      UpdateOrganizationRequisiteInputSchema.safeParse({ label: undefined })
        .success,
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
