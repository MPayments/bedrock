import { describe, expect, it } from "vitest";

import { DomainError, ValidationError } from "@bedrock/shared/core";

import { CountryCodeValue } from "../../src/domain/country-code";
import { OrganizationRequisiteDetails } from "../../src/domain/organization-requisite-details";

describe("organization domain value objects", () => {
  it("normalizes country codes by value", () => {
    expect(CountryCodeValue.create(" us ").value).toBe("US");
    expect(CountryCodeValue.create("US").equals(CountryCodeValue.create(" us ")))
      .toBe(true);
  });

  it("rejects invalid country codes", () => {
    expect(() => CountryCodeValue.create("ZZ")).toThrow(DomainError);
  });

  it("normalizes requisite details and compares them by value", () => {
    const details = OrganizationRequisiteDetails.create({
      kind: "bank",
      description: "  Main bank  ",
      beneficiaryName: "  Acme LLC  ",
      institutionName: "  Core Bank  ",
      institutionCountry: "  US  ",
      accountNo: "  123456  ",
      bic: "  044525225  ",
    });

    expect(details.toFields()).toMatchObject({
      kind: "bank",
      description: "Main bank",
      beneficiaryName: "Acme LLC",
      institutionName: "Core Bank",
      institutionCountry: "US",
      accountNo: "123456",
      bic: "044525225",
      swift: null,
    });
    expect(details.resolveIdentity()).toBe("123456");
    expect(details.equals(OrganizationRequisiteDetails.create({
      kind: "bank",
      description: "Main bank",
      beneficiaryName: "Acme LLC",
      institutionName: "Core Bank",
      institutionCountry: "US",
      accountNo: "123456",
      bic: "044525225",
    }))).toBe(true);
  });

  it("enforces requisite invariants by kind", () => {
    expect(() => OrganizationRequisiteDetails.create({
      kind: "blockchain",
      network: "ETH",
      assetCode: "USDT",
    })).toThrow(ValidationError);
  });
});
