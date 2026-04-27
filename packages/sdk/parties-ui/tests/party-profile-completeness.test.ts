import { describe, expect, it } from "vitest";

import type { PartyProfileBundleInput } from "../src/lib/contracts";
import { computePartyProfileCompleteness } from "../src/lib/party-profile-completeness";

function emptyBundle(): PartyProfileBundleInput {
  return {
    profile: {
      fullName: "",
      shortName: "",
      fullNameI18n: null,
      shortNameI18n: null,
      legalFormCode: null,
      legalFormLabel: null,
      legalFormLabelI18n: null,
      countryCode: null,
      businessActivityCode: null,
      businessActivityText: null,
      businessActivityTextI18n: null,
    },
    identifiers: [],
    address: null,
    contacts: [],
    representatives: [],
    licenses: [],
  };
}

describe("computePartyProfileCompleteness", () => {
  it("returns zero completeness for null bundle", () => {
    expect(computePartyProfileCompleteness(null)).toEqual({
      filled: 0,
      total: 0,
      ratio: 0,
    });
  });

  it("counts profile i18n slots even when bundle is empty", () => {
    const result = computePartyProfileCompleteness(emptyBundle());
    expect(result.total).toBe(8);
    expect(result.filled).toBe(0);
    expect(result.ratio).toBe(0);
  });

  it("counts half-filled i18n fields correctly", () => {
    const bundle = emptyBundle();
    bundle.profile.fullNameI18n = { ru: "Имя", en: null };
    bundle.profile.shortNameI18n = { ru: "Кр", en: "Sh" };

    const result = computePartyProfileCompleteness(bundle);
    expect(result.total).toBe(8);
    expect(result.filled).toBe(3);
    expect(result.ratio).toBeCloseTo(3 / 8);
  });

  it("excludes profile name slots when excludeProfileNames is set", () => {
    const bundle = emptyBundle();
    bundle.profile.fullNameI18n = { ru: "Имя", en: "Name" };
    bundle.profile.legalFormLabelI18n = { ru: "ООО", en: null };

    const result = computePartyProfileCompleteness(bundle, {
      excludeProfileNames: true,
    });
    // Without fullName/shortName: legalFormLabel + businessActivityText = 4 slots
    expect(result.total).toBe(4);
    expect(result.filled).toBe(1);
  });

  it("includes extra bilingual pairs in the total", () => {
    const result = computePartyProfileCompleteness(null, {
      extraPairs: [
        { ru: "Кр", en: "Sh" },
        { ru: "Полный", en: "" },
        { ru: "", en: "" },
      ],
    });
    expect(result.total).toBe(6);
    expect(result.filled).toBe(3);
  });

  it("combines extraPairs with bundle fields", () => {
    const bundle = emptyBundle();
    bundle.profile.legalFormLabelI18n = { ru: "ООО", en: "LLC" };

    const result = computePartyProfileCompleteness(bundle, {
      excludeProfileNames: true,
      extraPairs: [{ ru: "Кр", en: "Sh" }],
    });
    // bundle: legalFormLabel + businessActivityText = 4 slots (1 fully filled = 2)
    // extraPairs: 1 pair = 2 slots (both filled = 2)
    // total = 6, filled = 4
    expect(result.total).toBe(6);
    expect(result.filled).toBe(4);
  });

  it("includes nested address / representatives / licenses i18n fields", () => {
    const bundle = emptyBundle();
    bundle.address = {
      countryCode: "RU",
      postalCode: null,
      city: "Москва",
      cityI18n: { ru: "Москва", en: "Moscow" },
      streetAddress: null,
      streetAddressI18n: null,
      addressDetails: null,
      addressDetailsI18n: null,
      fullAddress: null,
      fullAddressI18n: null,
    };
    bundle.representatives = [
      {
        role: "director",
        fullName: "Иванов",
        fullNameI18n: { ru: "Иванов", en: "Ivanov" },
        title: null,
        titleI18n: null,
        basisDocument: null,
        basisDocumentI18n: null,
        isPrimary: true,
      },
    ];
    bundle.licenses = [
      {
        licenseType: "company_license",
        licenseNumber: "000",
        issuedBy: null,
        issuedByI18n: { ru: "ЦБ", en: null },
        issuedAt: null,
        expiresAt: null,
        activityCode: null,
        activityText: null,
        activityTextI18n: null,
      },
    ];

    const result = computePartyProfileCompleteness(bundle);
    // profile: 4 slots * 2 = 8
    // address: 4 * 2 = 8
    // 1 representative: 3 * 2 = 6
    // 1 license: 2 * 2 = 4
    // total = 26
    expect(result.total).toBe(26);
    expect(result.filled).toBe(2 + 2 + 1);
  });
});
