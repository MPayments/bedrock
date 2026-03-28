import { describe, expect, it } from "vitest";

import { presentFxQuotesTableResult } from "@/features/treasury/quotes/lib/presentation";

describe("treasury quotes list presentation", () => {
  it("enriches active quotes with a treasury-native FX stage", () => {
    const view = presentFxQuotesTableResult({
      linkedDocumentsById: {},
      result: {
        data: [
          {
            id: "quote-1",
            idempotencyKey: "quote-ref-1",
            fromCurrencyId: "currency-usd",
            toCurrencyId: "currency-eur",
            fromCurrency: "USD",
            toCurrency: "EUR",
            fromAmountMinor: "100000",
            toAmountMinor: "91500",
            fromAmount: "1000",
            toAmount: "915",
            pricingMode: "auto_cross",
            pricingTrace: {},
            dealDirection: null,
            dealForm: null,
            rateNum: "915",
            rateDen: "1000",
            status: "active",
            usedByRef: null,
            usedAt: null,
            expiresAt: new Date("2026-03-27T10:15:00.000Z"),
            createdAt: new Date("2026-03-27T10:00:00.000Z"),
          },
        ],
        total: 1,
        limit: 25,
        offset: 0,
      },
    });

    expect(view.data[0]?.linkedArtifact).toBeNull();
    expect(view.data[0]?.stage).toMatchObject({
      badgeLabel: "Котировка активна",
      title: "FX еще не оформлен",
      contextLabel: "Пока без связанного FX документа",
    });
  });

  it("uses linked fx_execute details to derive a richer stage and artifact label", () => {
    const view = presentFxQuotesTableResult({
      linkedDocumentsById: {
        "00000000-0000-4000-8000-000000000301": {
          document: {
            id: "00000000-0000-4000-8000-000000000301",
            docType: "fx_execute",
            docNo: "FX-301",
            payloadVersion: 1,
            payload: {},
            title: "Казначейский FX",
            occurredAt: "2026-03-27T10:00:00.000Z",
            submissionStatus: "draft",
            approvalStatus: "not_required",
            postingStatus: "unposted",
            lifecycleStatus: "active",
            allowedActions: [],
            createIdempotencyKey: null,
            amount: null,
            currency: null,
            memo: null,
            counterpartyId: null,
            customerId: null,
            organizationRequisiteId: null,
            searchText: "",
            createdBy: "user-1",
            submittedBy: null,
            submittedAt: null,
            approvedBy: null,
            approvedAt: null,
            rejectedBy: null,
            rejectedAt: null,
            cancelledBy: null,
            cancelledAt: null,
            postingStartedAt: null,
            postedAt: null,
            postingError: null,
            createdAt: "2026-03-27T10:00:00.000Z",
            updatedAt: "2026-03-27T10:00:00.000Z",
            version: 1,
            postingOperationId: null,
          },
          links: [],
          parent: null,
          children: [],
          dependsOn: [],
          compensates: [],
          documentOperations: [],
          ledgerOperations: [],
        },
      },
      result: {
        data: [
          {
            id: "quote-1",
            idempotencyKey: "quote-ref-1",
            fromCurrencyId: "currency-usd",
            toCurrencyId: "currency-eur",
            fromCurrency: "USD",
            toCurrency: "EUR",
            fromAmountMinor: "100000",
            toAmountMinor: "91500",
            fromAmount: "1000",
            toAmount: "915",
            pricingMode: "auto_cross",
            pricingTrace: {},
            dealDirection: null,
            dealForm: null,
            rateNum: "915",
            rateDen: "1000",
            status: "used",
            usedByRef: "fx_execute:00000000-0000-4000-8000-000000000301",
            usedAt: new Date("2026-03-27T10:05:00.000Z"),
            expiresAt: new Date("2026-03-27T10:15:00.000Z"),
            createdAt: new Date("2026-03-27T10:00:00.000Z"),
          },
        ],
        total: 1,
        limit: 25,
        offset: 0,
      },
    });

    expect(view.data[0]?.linkedArtifact).toEqual({
      href: "/documents/ifrs/fx_execute/00000000-0000-4000-8000-000000000301",
      label: "FX-301",
    });
    expect(view.data[0]?.stage).toMatchObject({
      badgeLabel: "Черновик",
      title: "FX оформлен как черновик",
      contextLabel: "Связанный документ: FX-301",
    });
  });
});
