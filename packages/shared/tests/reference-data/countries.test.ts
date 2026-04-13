import { describe, expect, it } from "vitest";

import {
  COUNTRIES,
  COUNTRY_ALPHA2_SET,
  getCountryByAlpha2,
  isValidAlpha2,
  normalizeToAlpha2,
} from "@bedrock/shared/reference-data/countries";

describe("countries constants", () => {
    it("contains all country codes", () => {
        expect(COUNTRIES.length).toBe(249);
        expect(COUNTRY_ALPHA2_SET.size).toBe(249);
    });

    it("normalizes alpha2, alpha3 and country names", () => {
        expect(normalizeToAlpha2("US")).toBe("US");
        expect(normalizeToAlpha2("usa")).toBe("US");
        expect(normalizeToAlpha2("UAE")).toBe("AE");
        expect(normalizeToAlpha2("Франция")).toBe("FR");
        expect(normalizeToAlpha2("Соединенные Штаты")).toBe("US");
        expect(normalizeToAlpha2("France")).toBe("FR");
        expect(normalizeToAlpha2("Cote d'Ivoire")).toBe("CI");
    });

    it("returns null for unknown values", () => {
        expect(normalizeToAlpha2("not-a-country")).toBeNull();
        expect(normalizeToAlpha2("ZZZ")).toBeNull();
        expect(normalizeToAlpha2("   ")).toBeNull();
    });

    it("validates and resolves alpha2 codes", () => {
        expect(isValidAlpha2("us")).toBe(true);
        expect(isValidAlpha2("ZZ")).toBe(false);

        const us = getCountryByAlpha2("us");
        expect(us).not.toBeNull();
        expect(us?.alpha3).toBe("USA");
        expect(us?.emoji).toBe("🇺🇸");
    });
});
