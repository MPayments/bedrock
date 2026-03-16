import { describe, expect, it } from "vitest";

import {
  CountryCodeValue,
  normalizeOptionalCountryCode,
  parseOptionalCountryCode,
} from "../src/requisites";
import { PARTY_KIND_VALUES } from "../src/parties";

describe("shared requisites helpers", () => {
  it("normalizes optional country codes", () => {
    expect(normalizeOptionalCountryCode(" ru ")).toBe("RU");
    expect(parseOptionalCountryCode(" us ")).toBe("US");
    expect(normalizeOptionalCountryCode("   ")).toBeNull();
    expect(parseOptionalCountryCode(undefined)).toBeNull();
  });

  it("keeps country code value object behavior", () => {
    expect(CountryCodeValue.create("DE").value).toBe("DE");
  });
});

describe("shared party helpers", () => {
  it("exports stable party kind values", () => {
    expect(PARTY_KIND_VALUES).toEqual(["legal_entity", "individual"]);
  });
});
