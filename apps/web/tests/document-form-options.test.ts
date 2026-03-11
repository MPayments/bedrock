import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerApiClient = vi.fn();
const readOptionsList = vi.fn();

vi.mock("@/lib/api/server-client", () => ({
  getServerApiClient,
}));

vi.mock("@/lib/api/query", () => ({
  readOptionsList,
}));

describe("document form options", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    getServerApiClient.mockResolvedValue({});
  });

  it("keeps successful option lists when one options request fails", async () => {
    readOptionsList
      .mockResolvedValueOnce({
        data: [{ id: "counterparty-1", label: "Contoso" }],
      })
      .mockRejectedValueOnce(new Error("organizations unavailable"))
      .mockResolvedValueOnce({
        data: [{ id: "usd", code: "USD", label: "US Dollar" }],
      });

    const { getDocumentFormOptions } = await import(
      "@/features/documents/lib/form-options"
    );

    await expect(getDocumentFormOptions()).resolves.toEqual({
      counterparties: [{ id: "counterparty-1", label: "Contoso" }],
      organizations: [],
      currencies: [{ id: "usd", code: "USD", label: "US Dollar" }],
    });
  });
});
