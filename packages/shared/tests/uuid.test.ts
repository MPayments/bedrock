import { describe, expect, it } from "vitest";

import { getUuidPrefix } from "../src/core/uuid";

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
