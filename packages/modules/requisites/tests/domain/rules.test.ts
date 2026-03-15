import { describe, expect, it } from "vitest";

import { buildRequisiteOptionLabel } from "../../src/domain/display-label";
import { resolveCreateRequisiteDefaultFlag, shouldPromoteNextDefault } from "../../src/domain/default-policy";
import { collectRequisiteFieldIssues } from "../../src/domain/requisite-fields";
import { collectRequisiteProviderIssues } from "../../src/domain/provider-rules";

describe("requisites domain rules", () => {
  it("requires bank requisites to include bank identity fields", () => {
    expect(
      collectRequisiteFieldIssues({
        kind: "bank",
        beneficiaryName: null,
        institutionName: null,
        institutionCountry: null,
        accountNo: null,
      }),
    ).toEqual([
      "beneficiaryName is required for bank requisites",
      "institutionName is required for bank requisites",
      "institutionCountry is required for bank requisites",
      "accountNo is required for bank requisites",
    ]);
  });

  it("enforces provider country and routing rules", () => {
    expect(
      collectRequisiteProviderIssues({
        kind: "bank",
        country: "US",
        bic: null,
        swift: null,
      }),
    ).toEqual(["swift is required for non-Russian banks"]);
  });

  it("builds option labels from label, identity, and currency", () => {
    expect(
      buildRequisiteOptionLabel({
        kind: "bank",
        label: "Main treasury",
        accountNo: "40702810",
        currencyCode: "usd",
      }),
    ).toBe("Main treasury · 40702810 · USD");
  });

  it("derives default switching decisions", () => {
    expect(
      resolveCreateRequisiteDefaultFlag({
        requestedIsDefault: false,
        existingActiveCount: 0,
      }),
    ).toBe(true);

    expect(
      shouldPromoteNextDefault({
        wasDefault: true,
        nextIsDefault: false,
        currencyChanged: false,
      }),
    ).toBe(true);
  });
});
