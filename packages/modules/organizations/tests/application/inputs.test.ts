import { describe, expect, it } from "vitest";

import { resolveOrganizationUpdateInput } from "../../src/application/organizations/inputs";
import { resolveOrganizationRequisiteUpdateInput } from "../../src/application/requisites/inputs";

describe("organization inputs", () => {
  it("resolves organization patches without leaving undefined fields", () => {
    expect(
      resolveOrganizationUpdateInput(
        {
          id: "org-1",
          externalId: null,
          shortName: "Acme",
          fullName: "Acme LLC",
          description: null,
          country: "US",
          kind: "legal_entity",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
        {
          description: "Treasury entity",
        },
      ),
    ).toEqual({
      externalId: null,
      shortName: "Acme",
      fullName: "Acme LLC",
      description: "Treasury entity",
      country: "US",
      kind: "legal_entity",
    });
  });

  it("resolves organization requisite patches without leaving undefined fields", () => {
    expect(
      resolveOrganizationRequisiteUpdateInput(
        {
          id: "req-1",
          organizationId: "org-1",
          providerId: "provider-1",
          currencyId: "currency-1",
          kind: "bank",
          label: "Main bank",
          description: null,
          beneficiaryName: null,
          institutionName: null,
          institutionCountry: null,
          accountNo: null,
          corrAccount: null,
          iban: null,
          bic: null,
          swift: null,
          bankAddress: null,
          network: null,
          assetCode: null,
          address: null,
          memoTag: null,
          accountRef: null,
          subaccountRef: null,
          contact: null,
          notes: null,
          isDefault: false,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          archivedAt: null,
        },
        {
          label: "Settlement bank",
          isDefault: true,
        },
      ),
    ).toEqual({
      providerId: "provider-1",
      currencyId: "currency-1",
      kind: "bank",
      label: "Settlement bank",
      description: null,
      beneficiaryName: null,
      institutionName: null,
      institutionCountry: null,
      accountNo: null,
      corrAccount: null,
      iban: null,
      bic: null,
      swift: null,
      bankAddress: null,
      network: null,
      assetCode: null,
      address: null,
      memoTag: null,
      accountRef: null,
      subaccountRef: null,
      contact: null,
      notes: null,
      isDefault: true,
    });
  });
});
