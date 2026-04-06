import { describe, expect, it } from "vitest";

import { calculateBpsAmount } from "../src/fees/domain/math";

describe("treasury fee math", () => {
  it("rounds percentage fees to the nearest minor unit", () => {
    expect(calculateBpsAmount(100050n, 125)).toBe(1251n);
    expect(calculateBpsAmount(1n, 5000)).toBe(1n);
    expect(calculateBpsAmount(1n, 4999)).toBe(0n);
  });
});
