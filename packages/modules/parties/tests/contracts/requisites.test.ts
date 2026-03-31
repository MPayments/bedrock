import { describe, expect, it } from "vitest";

import {
  CreateRequisiteInputSchema,
  CreateRequisiteProviderInputSchema,
  ListRequisiteOptionsQuerySchema,
  ListRequisiteProvidersQuerySchema,
  ListRequisitesQuerySchema,
  UpdateRequisiteInputSchema,
  UpdateRequisiteProviderInputSchema,
} from "../../src/contracts";

describe("requisites contracts", () => {
  it("parses create requisite input", () => {
    const parsed = CreateRequisiteInputSchema.parse({
      ownerType: "organization",
      ownerId: "00000000-0000-4000-8000-000000000111",
      providerId: "00000000-0000-4000-8000-000000000112",
      currencyId: "00000000-0000-4000-8000-000000000113",
      kind: "bank",
      label: "  Main bank  ",
      description: "   ",
      beneficiaryName: "  Acme Ltd  ",
      institutionName: "  JPM  ",
      accountNo: "  12345  ",
    });

    expect(parsed.label).toBe("Main bank");
    expect(parsed.description).toBeNull();
    expect(parsed.beneficiaryName).toBe("Acme Ltd");
    expect(parsed.isDefault).toBe(false);
  });

  it("rejects explicit undefined in update requisite input", () => {
    expect(
      UpdateRequisiteInputSchema.safeParse({ label: undefined }).success,
    ).toBe(false);
  });

  it("parses create provider input", () => {
    const parsed = CreateRequisiteProviderInputSchema.parse({
      kind: "bank",
      name: "  JPM  ",
      country: "us",
      bic: "  044525225  ",
      swift: "  CHASUS33  ",
    });

    expect(parsed.name).toBe("JPM");
    expect(parsed.country).toBe("US");
    expect(parsed.bic).toBe("044525225");
    expect(parsed.swift).toBe("CHASUS33");
  });

  it("rejects explicit undefined in update provider input", () => {
    expect(
      UpdateRequisiteProviderInputSchema.safeParse({ name: undefined }).success,
    ).toBe(false);
  });

  it("parses requisites and provider list queries", () => {
    const requisites = ListRequisitesQuerySchema.parse({
      ownerType: "organization",
      kind: "bank,exchange",
    });
    const providers = ListRequisiteProvidersQuerySchema.parse({
      bic: "044525225, 044525974",
      country: "US, DE",
      swift: "BOFAUS3N, CHASUS33",
    });

    expect(requisites.kind).toEqual(["bank", "exchange"]);
    expect(providers.bic).toEqual(["044525225", "044525974"]);
    expect(providers.country).toEqual(["US", "DE"]);
    expect(providers.swift).toEqual(["BOFAUS3N", "CHASUS33"]);
  });

  it("requires ownerType when ownerId is set in options query", () => {
    expect(
      ListRequisiteOptionsQuerySchema.safeParse({
        ownerId: "00000000-0000-4000-8000-000000000111",
      }).success,
    ).toBe(false);
  });
});
