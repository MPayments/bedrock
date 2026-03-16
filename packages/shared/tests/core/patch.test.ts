import { describe, expect, it } from "vitest";

import { resolvePatchValue } from "../../src/core/index";

describe("resolvePatchValue", () => {
  it("keeps the current value when the patch is undefined", () => {
    expect(resolvePatchValue("current", undefined)).toBe("current");
  });

  it("applies explicit patch values including null", () => {
    expect(resolvePatchValue("current", "next")).toBe("next");
    expect(resolvePatchValue<string | null>("current", null)).toBeNull();
  });
});
