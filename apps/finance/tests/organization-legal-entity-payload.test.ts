import { describe, expect, it } from "vitest";

import { buildOrganizationLegalEntityPayload } from "@/features/entities/organizations/lib/legal-entity-payload";

describe("organization legal entity payload", () => {
  it("reuses the loaded bundle and only projects editable anchor fields into the profile", () => {
    const payload = buildOrganizationLegalEntityPayload(
      {
        shortName: "Acme",
        shortNameEn: "",
        fullName: "Acme LLC",
        fullNameEn: "",
        kind: "legal_entity",
        country: "US",
        externalRef: "ext-1",
        description: "",
      },
      {
        profile: {
          id: "profile-1",
          organizationId: "org-1",
          counterpartyId: null,
          fullName: "Old Name",
          shortName: "Old Short",
          fullNameI18n: { ru: "Старое имя" },
          shortNameI18n: { ru: "Старое" },
          legalFormCode: "llc",
          legalFormLabel: "Limited Liability Company",
          legalFormLabelI18n: { ru: "ООО" },
          countryCode: "DE",
          businessActivityCode: "broker",
          businessActivityText: "Brokering",
          businessActivityTextI18n: { ru: "Брокерская деятельность" },
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
        identifiers: [{ id: "id-1", scheme: "inn", value: "123", normalizedValue: "123", partyLegalProfileId: "profile-1", createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z" }],
        address: { id: "addr-1", countryCode: "DE", postalCode: null, city: "Berlin", cityI18n: { ru: "Берлин" }, streetAddress: null, streetAddressI18n: null, addressDetails: null, addressDetailsI18n: null, fullAddress: "Berlin", fullAddressI18n: { ru: "Берлин" }, partyLegalProfileId: "profile-1", createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z" },
        contacts: [],
        representatives: [],
        licenses: [],
      },
    );

    expect(payload).toEqual({
      profile: {
        fullName: "Acme LLC",
        shortName: "Acme",
        fullNameI18n: { ru: "Старое имя" },
        shortNameI18n: { ru: "Старое" },
        legalFormCode: "llc",
        legalFormLabel: "Limited Liability Company",
        legalFormLabelI18n: { ru: "ООО" },
        countryCode: "US",
        businessActivityCode: "broker",
        businessActivityText: "Brokering",
        businessActivityTextI18n: { ru: "Брокерская деятельность" },
      },
      identifiers: [
        {
          id: "id-1",
          scheme: "inn",
          value: "123",
          normalizedValue: "123",
          partyLegalProfileId: "profile-1",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      address: {
        id: "addr-1",
        countryCode: "DE",
        postalCode: null,
        city: "Berlin",
        cityI18n: { ru: "Берлин" },
        streetAddress: null,
        streetAddressI18n: null,
        addressDetails: null,
        addressDetailsI18n: null,
        fullAddress: "Berlin",
        fullAddressI18n: { ru: "Берлин" },
        partyLegalProfileId: "profile-1",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
      contacts: [],
      representatives: [],
      licenses: [],
    });
  });
});
