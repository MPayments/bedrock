import { describe, expect, it } from "vitest";

import { DomainError, ValidationError } from "@bedrock/shared/core";

import { CounterpartyRequisiteDetails } from "../../src/domain/counterparty-requisite-details";
import { CountryCodeValue } from "../../src/domain/country-code";

describe("parties domain value objects", () => {
  it("normalizes country codes by value", () => {
    expect(CountryCodeValue.create(" de ").value).toBe("DE");
    expect(CountryCodeValue.create("DE").equals(CountryCodeValue.create(" de ")))
      .toBe(true);
  });

  it("rejects invalid country codes", () => {
    expect(() => CountryCodeValue.create("ZZ")).toThrow(DomainError);
  });

  it("normalizes counterparty requisite details and compares them by value", () => {
    const details = CounterpartyRequisiteDetails.create({
      kind: "exchange",
      description: "  Main venue  ",
      institutionName: "  Desk One  ",
      institutionCountry: "  GB  ",
      accountRef: "  acct-1  ",
      subaccountRef: "  desk-a  ",
    });

    expect(details.toFields()).toMatchObject({
      kind: "exchange",
      description: "Main venue",
      institutionName: "Desk One",
      institutionCountry: "GB",
      accountRef: "acct-1",
      subaccountRef: "desk-a",
    });
    expect(details.resolveIdentity()).toBe("acct-1");
    expect(details.equals(CounterpartyRequisiteDetails.create({
      kind: "exchange",
      description: "Main venue",
      institutionName: "Desk One",
      institutionCountry: "GB",
      accountRef: "acct-1",
      subaccountRef: "desk-a",
    }))).toBe(true);
  });

  it("enforces requisite invariants by kind", () => {
    expect(() => CounterpartyRequisiteDetails.create({
      kind: "exchange",
      institutionName: "Desk One",
    })).toThrow(ValidationError);
  });
});
