import { describe, expect, it } from "vitest";

import { applyPatch, resolvePatchValue } from "../../src/core/index";

describe("resolvePatchValue", () => {
  it("keeps the current value when the patch is undefined", () => {
    expect(resolvePatchValue("current", undefined)).toBe("current");
  });

  it("applies explicit patch values including null", () => {
    expect(resolvePatchValue("current", "next")).toBe("next");
    expect(resolvePatchValue<string | null>("current", null)).toBeNull();
  });
});

describe("applyPatch", () => {
  it("keeps fields whose patch values are undefined", () => {
    expect(
      applyPatch(
        {
          name: "current",
          description: "kept",
        },
        {
          name: undefined,
        },
      ),
    ).toEqual({
      name: "current",
      description: "kept",
    });
  });

  it("applies explicit patch values including null", () => {
    expect(
      applyPatch(
        {
          name: "current",
          description: "kept" as string | null,
        },
        {
          name: "next",
          description: null,
        },
      ),
    ).toEqual({
      name: "next",
      description: null,
    });
  });
});
