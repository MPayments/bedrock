import { describe, expect, it } from "vitest";

import {
  formatCompactId,
  formatCompactUuid,
  getUuidPrefix,
} from "../src/core/uuid";

describe("formatCompactId", () => {
  it("returns the uppercased first identifier segment", () => {
    expect(formatCompactId("69d37570-f03a-4b5e-8acb-5f3d30afdcdb")).toBe(
      "69D37570",
    );
  });

  it("uppercases non-UUID identifiers and trims hyphenated suffixes", () => {
    expect(formatCompactId("deal-123")).toBe("DEAL");
    expect(formatCompactId(" deal123 ")).toBe("DEAL123");
  });
});

describe("getUuidPrefix", () => {
  it("returns the first UUID segment", () => {
    expect(getUuidPrefix("69d37570-f03a-4b5e-8acb-5f3d30afdcdb")).toBe(
      "69d37570",
    );
  });

  it("keeps non-UUID values unchanged", () => {
    expect(getUuidPrefix("deal-123")).toBe("deal-123");
  });
});

describe("formatCompactUuid", () => {
  it("returns the uppercased first UUID segment", () => {
    expect(formatCompactUuid("69d37570-f03a-4b5e-8acb-5f3d30afdcdb")).toBe(
      "69D37570",
    );
  });

  it("uppercases non-UUID values without truncating", () => {
    expect(formatCompactUuid("deal-123")).toBe("DEAL-123");
    expect(formatCompactUuid("invoice")).toBe("INVOICE");
  });
});
