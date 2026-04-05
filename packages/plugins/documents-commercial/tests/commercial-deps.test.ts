import { describe, expect, it, vi } from "vitest";

import { createCommercialDocumentDeps } from "../src";

describe("commercial document deps", () => {
  it("marks invoice quote usage with explicit usedDocumentId", async () => {
    const markQuoteUsed = vi.fn(async () => ({
      id: "00000000-0000-4000-8000-000000000010",
      status: "used",
    }));

    const deps = createCommercialDocumentDeps({
      calculationReads: {
        findById: vi.fn(async () => null),
      },
      currenciesService: {
        findByCode: vi.fn(),
      } as any,
      dealReads: {
        findWorkflowById: vi.fn(async () => null),
      },
      documentsReadModel: {
        findBusinessLinkByDocumentId: vi.fn(async () => null),
      },
      partiesService: {
        counterparties: {
          findById: vi.fn(async () => ({ id: "counterparty-1" })),
        },
        customers: {
          findById: vi.fn(async () => ({ id: "customer-1" })),
        },
      },
      requisitesService: {
        resolveBindings: vi.fn(async () => []),
      },
      treasuryQuotes: {
        createQuote: vi.fn(),
        getQuoteDetails: vi.fn(),
        markQuoteUsed,
      },
    });

    await deps.quoteUsage.markQuoteUsedForInvoice({
      runtime: {} as any,
      quoteId: "00000000-0000-4000-8000-000000000010",
      invoiceDocumentId: "3510af80-077f-4a55-8803-5a330e144a0a",
      at: new Date("2026-04-05T08:35:00.000Z"),
    });

    expect(markQuoteUsed).toHaveBeenCalledWith({
      quoteId: "00000000-0000-4000-8000-000000000010",
      usedByRef: "invoice:3510af80-077f-4a55-8803-5a330e144a0a",
      usedDocumentId: "3510af80-077f-4a55-8803-5a330e144a0a",
      at: new Date("2026-04-05T08:35:00.000Z"),
    });
  });
});
