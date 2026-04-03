import { describe, expect, it } from "vitest";

import { PostingMatrix } from "../../src/chart/domain";

describe("accounting chart domain", () => {
  it("detects duplicate active correspondence rules", () => {
    const result = new PostingMatrix({
      rules: [
        {
          postingCode: "TR.1000",
          debitAccountNo: "1110",
          creditAccountNo: "2110",
          enabled: true,
        },
        {
          postingCode: "TR.1000",
          debitAccountNo: "1110",
          creditAccountNo: "2110",
          enabled: true,
        },
      ],
      accounts: [
        { accountNo: "1110", postingAllowed: true, enabled: true },
        { accountNo: "2110", postingAllowed: true, enabled: true },
      ],
      accountDimPolicies: [],
      postingCodeDimPolicies: [
        {
          postingCode: "TR.1000",
          dimensionKey: "organizationId",
          required: true,
          scope: "line",
        },
      ],
    }).validate();

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "DUPLICATE_ACTIVE_RULE",
          postingCode: "TR.1000",
        }),
      ]),
    );
  });
});
