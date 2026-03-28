import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveTreasuryFxCreatedDocumentHref } from "@/features/treasury/quotes/lib/fx-artifacts";

describe("treasury fx artifact helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects created fx_execute documents to treasury quote detail when quoteSnapshot exists", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        document: {
          payload: {
            quoteSnapshot: {
              quoteId: "00000000-0000-4000-8000-000000000010",
            },
          },
        },
      }),
    } as Response);

    await expect(
      resolveTreasuryFxCreatedDocumentHref({
        documentId: "00000000-0000-4000-8000-000000000011",
      }),
    ).resolves.toBe(
      "/treasury/quotes/00000000-0000-4000-8000-000000000010",
    );
  });

  it("falls back to treasury quotes when document details are missing quote snapshot", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        document: {
          payload: {},
        },
      }),
    } as Response);

    await expect(
      resolveTreasuryFxCreatedDocumentHref({
        documentId: "00000000-0000-4000-8000-000000000011",
      }),
    ).resolves.toBe("/treasury/quotes");
  });

  it("falls back to treasury quotes when details request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response);

    await expect(
      resolveTreasuryFxCreatedDocumentHref({
        documentId: "00000000-0000-4000-8000-000000000011",
      }),
    ).resolves.toBe("/treasury/quotes");
  });
});
