import { describe, expect, it } from "vitest";

import { DomainError } from "@bedrock/shared/core/domain";

import {
  RequisiteDetails,
  buildRequisiteDisplayLabel,
} from "../../src/requisites/domain/requisite-details";

describe("requisite details domain", () => {
  it("normalizes and builds display labels", () => {
    const details = RequisiteDetails.create({
      kind: "bank",
      description: "  Primary  ",
      beneficiaryName: "  Acme Corp  ",
      institutionName: "  JPM  ",
      accountNo: "  1234  ",
    });

    expect(
      buildRequisiteDisplayLabel({
        ...details.toFields(),
        label: "Main",
        currencyCode: "usd",
      }),
    ).toBe("Main · 1234 · USD");
  });

  it("rejects missing bank fields", () => {
    expect(() =>
      RequisiteDetails.create({
        kind: "bank",
        description: null,
      }),
    ).toThrow(DomainError);
  });
});
