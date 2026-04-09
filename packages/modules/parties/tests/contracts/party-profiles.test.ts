import { describe, expect, it } from "vitest";

import {
  LegalIdentifierSchemeSchema,
  PartyContactInputSchema,
  PartyLicenseInputSchema,
  PartyRepresentativeInputSchema,
} from "../../src/contracts";

describe("party profile taxonomies", () => {
  it("normalizes supported registry values", () => {
    expect(LegalIdentifierSchemeSchema.parse(" VAT-ID ")).toBe("vat_id");
    expect(
      PartyContactInputSchema.parse({
        type: " PHONE ",
        value: "+7 999 000 00 00",
      }).type,
    ).toBe("phone");
    expect(
      PartyRepresentativeInputSchema.parse({
        role: " Authorized Person ",
        fullName: "Jane Doe",
      }).role,
    ).toBe("authorized_person");
    expect(
      PartyLicenseInputSchema.parse({
        licenseType: " Company License ",
        licenseNumber: "LIC-1",
      }).licenseType,
    ).toBe("company_license");
  });

  it("allows the explicit other fallback", () => {
    expect(LegalIdentifierSchemeSchema.parse("other")).toBe("other");
    expect(
      PartyLicenseInputSchema.parse({
        licenseType: "other",
        licenseNumber: "FREEFORM-1",
      }).licenseType,
    ).toBe("other");
  });

  it("rejects unsupported taxonomy values", () => {
    expect(() =>
      PartyContactInputSchema.parse({
        type: "telegram",
        value: "@multihansa",
      }),
    ).toThrow();
  });
});
