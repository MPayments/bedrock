import { describe, it, expect, vi } from "vitest";

import { tbLedgerForCurrency } from "@bedrock/kernel";

vi.mock("node:crypto", () => ({
  createHash: vi.fn(() => ({
    update: vi.fn(() => ({
      digest: vi.fn(() => Buffer.alloc(32)),
    })),
  })),
}));

describe("tbLedgerForCurrency", () => {
  it("returns 1 when the computed hash maps to zero", async () => {
    expect(tbLedgerForCurrency("USD")).toBe(1);
  });
});
