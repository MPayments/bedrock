import { describe, expect, it } from "vitest";

import {
  CreateCounterpartyGroupInputSchema,
  CreateCounterpartyInputSchema,
  CreateCounterpartyRequisiteInputSchema,
  CreateCustomerInputSchema,
  ListCounterpartiesQuerySchema,
  ListCustomersQuerySchema,
  UpdateCounterpartyGroupInputSchema,
  UpdateCounterpartyInputSchema,
  UpdateCounterpartyRequisiteInputSchema,
  UpdateCustomerInputSchema,
} from "../../src/contracts";

describe("parties contracts", () => {
  it("parses create customer input", () => {
    const parsed = CreateCustomerInputSchema.parse({
      displayName: "  Acme Corp  ",
      externalRef: "  crm-123  ",
      description: "   ",
    });

    expect(parsed.displayName).toBe("Acme Corp");
    expect(parsed.externalRef).toBe("crm-123");
    expect(parsed.description).toBeNull();
  });

  it("parses update customer input with nullable fields", () => {
    const parsed = UpdateCustomerInputSchema.parse({
      displayName: "Acme Updated",
      externalRef: null,
      description: null,
    });

    expect(parsed.displayName).toBe("Acme Updated");
    expect(parsed.externalRef).toBeNull();
    expect(parsed.description).toBeNull();
  });

  it("rejects explicit undefined in update customer input", () => {
    expect(
      UpdateCustomerInputSchema.safeParse({ displayName: undefined }).success,
    ).toBe(false);
  });

  it("parses customer list query", () => {
    const parsed = ListCustomersQuerySchema.parse({
      limit: 20,
      offset: 0,
      sortBy: "displayName",
      sortOrder: "asc",
      displayName: "Acme",
      externalRef: "crm",
    });

    expect(parsed.limit).toBe(20);
    expect(parsed.sortBy).toBe("displayName");
    expect(parsed.displayName).toBe("Acme");
    expect(parsed.externalRef).toBe("crm");
  });

  it("parses create counterparty input", () => {
    const parsed = CreateCounterpartyInputSchema.parse({
      shortName: "  Acme ",
      fullName: "  Acme Incorporated  ",
      country: "us",
    });

    expect(parsed.shortName).toBe("Acme");
    expect(parsed.fullName).toBe("Acme Incorporated");
    expect(parsed.kind).toBe("legal_entity");
    expect(parsed.country).toBe("US");
    expect(parsed.externalId).toBeNull();
    expect(parsed.description).toBeNull();
    expect(parsed.customerId).toBeNull();
    expect(parsed.groupIds).toEqual([]);
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

  it("rejects explicit undefined in update counterparty input", () => {
    expect(
      UpdateCounterpartyInputSchema.safeParse({ shortName: undefined }).success,
    ).toBe(false);
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
  });

  it("parses list query with country filters", () => {
    const parsed = ListCounterpartiesQuerySchema.parse({
      country: "US, DE",
    });

    expect(parsed.country).toEqual(["US", "DE"]);
  });

  it("parses create counterparty group input", () => {
    const parsed = CreateCounterpartyGroupInputSchema.parse({
      code: "  customer-vip  ",
      name: "  Customer VIP  ",
    });

    expect(parsed.code).toBe("customer-vip");
    expect(parsed.name).toBe("Customer VIP");
    expect(parsed.customerId).toBeNull();
    expect(parsed.parentId).toBeNull();
    expect(parsed.description).toBeNull();
  });

  it("rejects explicit undefined in update group input", () => {
    expect(
      UpdateCounterpartyGroupInputSchema.safeParse({ code: undefined }).success,
    ).toBe(false);
  });

  it("parses create counterparty requisite input into concrete values", () => {
    const parsed = CreateCounterpartyRequisiteInputSchema.parse({
      counterpartyId: "550e8400-e29b-41d4-a716-446655440001",
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

  it("rejects explicit undefined in update requisite input", () => {
    expect(
      UpdateCounterpartyRequisiteInputSchema.safeParse({ label: undefined })
        .success,
    ).toBe(false);
  });
});
