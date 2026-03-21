import { describe, expect, it } from "vitest";

import {
  CreateCustomerInputSchema,
  ListCustomersQuerySchema,
  UpdateCustomerInputSchema,
} from "../../src/contracts";

describe("customers contracts", () => {
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
});
