import { sanitizeInputValue } from "@bedrock/sdk-ui/components/input";
import { describe, expect, it } from "vitest";

describe("sanitizeInputValue", () => {
  it("keeps only digits for numeric input mode", () => {
    expect(sanitizeInputValue("12a-3 4", "numeric")).toBe("1234");
  });

  it("keeps only decimal characters for decimal input mode", () => {
    expect(sanitizeInputValue("1a2,3.4.5", "decimal")).toBe("12.345");
  });

  it("prefixes a leading decimal separator with zero", () => {
    expect(sanitizeInputValue(".75", "decimal")).toBe("0.75");
  });

  it("does not change values without numeric sanitization", () => {
    expect(sanitizeInputValue("abc-123", "text")).toBe("abc-123");
  });
});
