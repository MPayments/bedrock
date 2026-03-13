import { describe, expect, it } from "vitest";

import {
  CreateCounterpartyInputSchema,
  CreateCounterpartyGroupInputSchema,
  ListCounterpartiesQuerySchema,
  UpdateCounterpartyInputSchema,
} from "../../src/validation";

describe("counterparties validation", () => {
  it("parses create counterparty input", () => {
    const parsed = CreateCounterpartyInputSchema.parse({
      shortName: "Acme",
      fullName: "Acme Incorporated",
      kind: "legal_entity",
      country: "us",
      groupIds: [],
    });

    expect(parsed.shortName).toBe("Acme");
    expect(parsed.fullName).toBe("Acme Incorporated");
    expect(parsed.kind).toBe("legal_entity");
    expect(parsed.country).toBe("US");
  });

  it("parses update counterparty input with nullable fields", () => {
    const parsed = UpdateCounterpartyInputSchema.parse({
      country: null,
      description: null,
      customerId: null,
    });

    expect(parsed.country).toBeNull();
    expect(parsed.description).toBeNull();
    expect(parsed.customerId).toBeNull();
  });

  it("rejects invalid country codes", () => {
    expect(() =>
      CreateCounterpartyInputSchema.parse({
        shortName: "Acme",
        fullName: "Acme Incorporated",
        kind: "legal_entity",
        country: "ZZ",
        groupIds: [],
      }),
    ).toThrow();

    expect(() =>
      CreateCounterpartyInputSchema.parse({
        shortName: "Acme",
        fullName: "Acme Incorporated",
        kind: "legal_entity",
        country: "U1",
        groupIds: [],
      }),
    ).toThrow();

    expect(() =>
      CreateCounterpartyInputSchema.parse({
        shortName: "Acme",
        fullName: "Acme Incorporated",
        kind: "legal_entity",
        country: "",
        groupIds: [],
      }),
    ).toThrow();
  });

  it("parses list query with multi country filters", () => {
    const parsed = ListCounterpartiesQuerySchema.parse({
      country: "US, DE",
    });

    expect(parsed.country).toEqual(["US", "DE"]);
  });

  it("parses list query with customer filter", () => {
    const parsed = ListCounterpartiesQuerySchema.parse({
      customerId: "550e8400-e29b-41d4-a716-446655440001",
    });

    expect(parsed.customerId).toBe("550e8400-e29b-41d4-a716-446655440001");
  });

  it("parses create counterparty group input", () => {
    const parsed = CreateCounterpartyGroupInputSchema.parse({
      code: "customer-vip",
      name: "Customer VIP",
      customerId: "550e8400-e29b-41d4-a716-446655440001",
    });

    expect(parsed.code).toBe("customer-vip");
    expect(parsed.customerId).toBe("550e8400-e29b-41d4-a716-446655440001");
  });
});
