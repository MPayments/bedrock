import { describe, it, expect, vi } from "vitest";

vi.mock("node:crypto", () => ({
  createHash: vi.fn(() => ({
    update: vi.fn(() => ({
      digest: vi.fn(() => Buffer.alloc(32)),
    })),
  })),
}));

describe("tbLedgerForCurrency", () => {
  it("returns 1 when the computed hash maps to zero", async () => {
    const { tbLedgerForCurrency } = await import("../src/ids");
    expect(tbLedgerForCurrency("USD")).toBe(1);
  });
});
