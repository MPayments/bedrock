import { describe, expect, it } from "vitest";

import {
  CreateOrganizationInputSchema,
  ListOrganizationsQuerySchema,
  UpdateOrganizationInputSchema,
} from "../../src/contracts";

describe("organizations contracts", () => {
  it("parses create organization input", () => {
    const parsed = CreateOrganizationInputSchema.parse({
      shortName: "  Acme  ",
      fullName: "  Acme Incorporated  ",
      country: "us",
      externalId: "  ext-1  ",
      description: "   ",
      partyProfile: {
        profile: {
          fullName: "  Acme Incorporated  ",
          shortName: "  Acme  ",
          countryCode: "us",
        },
        identifiers: [],
        address: null,
        contacts: [],
        representatives: [],
        licenses: [],
      },
    });

    expect(parsed.shortName).toBe("Acme");
    expect(parsed.fullName).toBe("Acme Incorporated");
    expect(parsed.country).toBe("US");
    expect(parsed.externalId).toBe("ext-1");
    expect(parsed.description).toBeNull();
  });

  it("rejects explicit undefined in update organization input", () => {
    expect(
      UpdateOrganizationInputSchema.safeParse({ externalId: undefined }).success,
    ).toBe(false);
  });

  it("parses organizations list query", () => {
    const parsed = ListOrganizationsQuerySchema.parse({
      shortName: "Acme",
      country: "US, DE",
      kind: "legal_entity",
    });

    expect(parsed.shortName).toBe("Acme");
    expect(parsed.country).toEqual(["US", "DE"]);
    expect(parsed.kind).toEqual(["legal_entity"]);
  });
});
