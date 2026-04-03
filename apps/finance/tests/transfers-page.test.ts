import { beforeEach, describe, expect, it, vi } from "vitest";

const REDIRECT = new Error("REDIRECT");

const redirect = vi.fn(() => {
  throw REDIRECT;
});

vi.mock("next/navigation", () => ({
  redirect,
}));

describe("transfers page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects the legacy transfers route to documents transfers", async () => {
    const { default: TransfersPage } = await import("@/app/(shell)/transfers/page");

    expect(() => TransfersPage()).toThrow(REDIRECT);
    expect(redirect).toHaveBeenCalledWith("/documents/transfers");
  });
});
