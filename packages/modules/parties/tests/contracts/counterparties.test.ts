import { describe, expect, it } from "vitest";

import {
  CreateCounterpartyGroupInputSchema,
  CreateCounterpartyInputSchema,
  ListCounterpartiesQuerySchema,
  ListCounterpartyGroupsQuerySchema,
  UpdateCounterpartyGroupInputSchema,
  UpdateCounterpartyInputSchema,
} from "../../src/contracts";

describe("counterparties contracts", () => {
  it("parses create counterparty input", () => {
    const parsed = CreateCounterpartyInputSchema.parse({
      shortName: "  Acme ",
      fullName: "  Acme Incorporated  ",
      country: "us",
      externalRef: "  ext-1  ",
      description: "   ",
      partyProfile: {
        profile: {
          fullName: "  Acme Incorporated  ",
          shortName: "  Acme ",
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
    expect(parsed.kind).toBe("legal_entity");
    expect(parsed.country).toBe("US");
    expect(parsed.externalRef).toBe("ext-1");
    expect(parsed.description).toBeNull();
    expect(parsed.customerId).toBeNull();
    expect(parsed.groupIds).toEqual([]);
  });

  it("rejects explicit undefined in update counterparty input", () => {
    expect(
      UpdateCounterpartyInputSchema.safeParse({ externalRef: undefined }).success,
    ).toBe(false);
  });

  it("parses counterparty list query", () => {
    const parsed = ListCounterpartiesQuerySchema.parse({
      country: "US, DE",
      kind: "legal_entity",
      groupIds:
        "00000000-0000-4000-8000-000000000111,00000000-0000-4000-8000-000000000112",
    });

    expect(parsed.country).toEqual(["US", "DE"]);
    expect(parsed.kind).toEqual(["legal_entity"]);
    expect(parsed.groupIds).toEqual([
      "00000000-0000-4000-8000-000000000111",
      "00000000-0000-4000-8000-000000000112",
    ]);
  });

  it("parses create counterparty group input", () => {
    const parsed = CreateCounterpartyGroupInputSchema.parse({
      code: "  vip  ",
      name: "  VIP  ",
      description: "   ",
    });

    expect(parsed.code).toBe("vip");
    expect(parsed.name).toBe("VIP");
    expect(parsed.description).toBeNull();
    expect(parsed.parentId).toBeNull();
    expect(parsed.customerId).toBeNull();
  });

  it("rejects explicit undefined in update group input", () => {
    expect(
      UpdateCounterpartyGroupInputSchema.safeParse({ code: undefined }).success,
    ).toBe(false);
  });

  it("parses group list query", () => {
    const parsed = ListCounterpartyGroupsQuerySchema.parse({
      includeSystem: "true",
    });

    expect(parsed.includeSystem).toBe(true);
  });
});
