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

  it("exposes actual provider fee lines from treasury execution fees in deal fx context", async () => {
    const deps = createCommercialDocumentDeps({
      calculationReads: {
        findById: vi.fn(async () => ({
          currentSnapshot: {
            calculationCurrencyId: "00000000-0000-4000-8000-000000000001",
            fxQuoteId: null,
            originalAmountMinor: "10000",
            quoteSnapshot: null,
            totalAmountMinor: "10150",
          },
          id: "calc-1",
          lines: [
            {
              amountMinor: "150",
              classification: "revenue",
              componentFamily: "fee_revenue",
              currencyId: "00000000-0000-4000-8000-000000000001",
              id: "line-1",
              kind: "fee_revenue",
            },
            {
              amountMinor: "30",
              classification: "expense",
              componentFamily: "provider_fee_expense",
              currencyId: "00000000-0000-4000-8000-000000000001",
              id: "line-2",
              kind: "provider_fee_expense",
            },
          ],
        })),
      },
      currenciesService: {
        findByCode: vi.fn(),
        findById: vi.fn(async () => ({
          code: "USD",
          id: "00000000-0000-4000-8000-000000000001",
        })),
      } as any,
      dealReads: {
        findWorkflowById: vi.fn(async () => ({
          executionPlan: [{ kind: "convert" }],
          fundingResolution: {
            availableMinor: null,
            fundingOrganizationId: "org-1",
            fundingRequisiteId: null,
            reasonCode: "inventory_insufficient",
            requiredAmountMinor: "9200",
            state: "resolved",
            strategy: "external_fx",
            targetCurrency: "USD",
            targetCurrencyId: "00000000-0000-4000-8000-000000000001",
          },
          summary: {
            calculationId: "calc-1",
            type: "payment",
          },
        })),
      } as any,
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
      treasuryExecutionActuals: {
        listExecutionFees: vi.fn(async () => ({
          data: [
            {
              amountMinor: "55",
              calculationSnapshotId: null,
              chargedAt: new Date("2026-04-05T08:40:00.000Z"),
              confirmedAt: null,
              componentCode: null,
              createdAt: new Date("2026-04-05T08:40:00.000Z"),
              currencyId: "00000000-0000-4000-8000-000000000001",
              dealId: "deal-1",
              externalRecordId: "record-1",
              feeFamily: "provider_fee",
              fillId: null,
              id: "fee-1",
              instructionId: null,
              metadata: null,
              notes: null,
              operationId: "operation-1",
              providerCounterpartyId: null,
              providerRef: null,
              routeComponentId: null,
              routeLegId: null,
              routeVersionId: null,
              sourceKind: "reconciliation",
              sourceRef: "fee-source-1",
              updatedAt: new Date("2026-04-05T08:40:00.000Z"),
            },
          ],
        })),
      },
      treasuryQuotes: {
        createQuote: vi.fn(),
        getQuoteDetails: vi.fn(),
        markQuoteUsed: vi.fn(),
      },
    });

    const context = await deps.dealFx.resolveDealFxContext("deal-1");

    expect(context?.actualFinancialLines).toEqual([
      expect.objectContaining({
        amountMinor: 55n,
        bucket: "provider_fee_expense",
        currency: "USD",
        id: "actual:provider_fee_expense:USD",
        source: "manual",
      }),
    ]);
  });
});
