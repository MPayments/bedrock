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
      paymentPurposeTemplate: "   ",
      beneficiaryName: "  Acme Ltd  ",
      identifiers: [
        {
          scheme: "local_account_number",
          value: "  12345  ",
          isPrimary: true,
        },
      ],
    });

    expect(parsed.label).toBe("Main bank");
    expect(parsed.paymentPurposeTemplate).toBeNull();
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
      legalName: "  JPM Chase Bank  ",
      legalNameI18n: { en: "  JPM Chase Bank  ", ru: "  Банк JPM Chase  " },
      displayName: "  JPM  ",
      displayNameI18n: { en: " JPM ", ru: " Джей Пи Морган " },
      country: "us",
      branches: [
        {
          name: "Main Branch",
          nameI18n: { ru: "Главный филиал" },
          country: "us",
          city: "New York",
          cityI18n: { ru: "Нью-Йорк" },
          rawAddress: "270 Park Avenue, New York",
          rawAddressI18n: { ru: "270 Park Avenue, Нью-Йорк" },
        },
      ],
      identifiers: [
        { scheme: "BIC", value: "  044525225  ", isPrimary: true },
        { scheme: " SWIFT ", value: "  CHASUS33  ", isPrimary: true },
      ],
    });

    expect(parsed.legalName).toBe("JPM Chase Bank");
    expect(parsed.legalNameI18n).toEqual({
      en: "JPM Chase Bank",
      ru: "Банк JPM Chase",
    });
    expect(parsed.displayName).toBe("JPM");
    expect(parsed.displayNameI18n).toEqual({
      en: "JPM",
      ru: "Джей Пи Морган",
    });
    expect(parsed.country).toBe("US");
    expect(parsed.branches[0]?.cityI18n).toEqual({ ru: "Нью-Йорк" });
    expect(parsed.identifiers[0]?.scheme).toBe("bic");
    expect(parsed.identifiers[1]?.scheme).toBe("swift");
    expect(parsed.identifiers).toHaveLength(2);
  });

  it("rejects unsupported provider identifier schemes", () => {
    expect(
      CreateRequisiteProviderInputSchema.safeParse({
        kind: "bank",
        legalName: "JPM Chase Bank",
        displayName: "JPM",
        identifiers: [{ scheme: "custom_scheme", value: "123", isPrimary: true }],
      }).success,
    ).toBe(false);
  });

  it("rejects explicit undefined in update provider input", () => {
    expect(
      UpdateRequisiteProviderInputSchema.safeParse({ legalName: undefined }).success,
    ).toBe(false);
  });

  it("parses requisites and provider list queries", () => {
    const requisites = ListRequisitesQuerySchema.parse({
      ownerType: "organization",
      kind: "bank,exchange",
    });
    const providers = ListRequisiteProvidersQuerySchema.parse({
      country: "US, DE",
      legalName: "Chase",
    });

    expect(requisites.kind).toEqual(["bank", "exchange"]);
    expect(providers.country).toEqual(["US", "DE"]);
    expect(providers.legalName).toBe("Chase");
  });

  it("requires ownerType when ownerId is set in options query", () => {
    expect(
      ListRequisiteOptionsQuerySchema.safeParse({
        ownerId: "00000000-0000-4000-8000-000000000111",
      }).success,
    ).toBe(false);
  });
});
