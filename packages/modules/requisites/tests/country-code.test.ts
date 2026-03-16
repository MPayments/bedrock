import { describe, expect, it } from "vitest";

import { DomainError } from "@bedrock/shared/core";

import {
  CountryCodeValue,
  normalizeCountryCode,
} from "../src/domain/country-code";

describe("requisite provider country code value object", () => {
  it("normalizes valid codes by value", () => {
    expect(normalizeCountryCode(" ru ")).toBe("RU");
    expect(CountryCodeValue.create("RU").equals(CountryCodeValue.create(" ru ")))
      .toBe(true);
  });

  it("returns null for empty optional values", () => {
    expect(CountryCodeValue.createOptional("   ")).toBeNull();
    expect(normalizeCountryCode("   ")).toBeNull();
  });

  it("rejects invalid country codes", () => {
    expect(() => CountryCodeValue.create("ZZ")).toThrow(DomainError);
  });
});
