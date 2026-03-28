import { describe, expect, it } from "vitest";

import {
  presentLinkedFxDocumentArtifact,
} from "@/features/treasury/quotes/lib/detail-presentation";
import { presentFxQuoteStage } from "@/features/treasury/quotes/lib/stage";

describe("treasury quote detail presentation", () => {
  it("derives a treasury-native stage for active quotes without a linked document", () => {
    expect(
      presentFxQuoteStage({
        quote: {
          status: "active",
          usedByRef: null,
        },
        linkedDocument: null,
      }),
    ).toEqual({
      badgeLabel: "Котировка активна",
      badgeVariant: "default",
      title: "FX еще не оформлен",
      description:
        "Quote уже рассчитан и может быть использован для создания FX документа, пока срок действия не истек.",
      nextAction:
        "Если конверсия подтверждена, оформите FX документ по этой котировке.",
      contextLabel: "Пока без связанного FX документа",
    });
  });

  it("derives a treasury-native stage for draft linked fx documents", () => {
    expect(
      presentFxQuoteStage({
        quote: {
          status: "used",
          usedByRef: "fx_execute:00000000-0000-4000-8000-000000000301",
        },
        linkedDocument: {
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
      }),
    ).toEqual({
      badgeLabel: "Черновик",
      badgeVariant: "secondary",
      title: "FX оформлен как черновик",
      description:
        "Котировка уже использована для FX документа, но сам документ еще не отправлен дальше по процессу.",
      nextAction:
        "Откройте документ и завершите оформление, если конверсия должна идти дальше.",
      contextLabel: "Связанный документ: FX-301",
    });
  });

  it("builds a secondary linked FX document view from fx_execute details", () => {
    const view = presentLinkedFxDocumentArtifact({
      details: {
        document: {
          id: "00000000-0000-4000-8000-000000000301",
          docType: "fx_execute",
          docNo: "FX-301",
          payloadVersion: 1,
          payload: {
            occurredAt: "2026-03-27T10:00:00.000Z",
            ownershipMode: "cross_org",
            sourceOrganizationId: "00000000-0000-4000-8000-000000000201",
            sourceRequisiteId: "00000000-0000-4000-8000-000000000111",
            destinationOrganizationId: "00000000-0000-4000-8000-000000000202",
            destinationRequisiteId: "00000000-0000-4000-8000-000000000112",
            amount: "1000",
            amountMinor: "100000",
            executionRef: "FX-EXEC-301",
            financialLines: [],
            quoteSnapshot: {
              quoteId: "00000000-0000-4000-8000-000000000010",
              idempotencyKey: "quote-ref-1",
              fromCurrency: "USD",
              toCurrency: "EUR",
              fromAmountMinor: "100000",
              toAmountMinor: "91500",
              pricingMode: "auto_cross",
              rateNum: "915",
              rateDen: "1000",
              expiresAt: "2026-03-27T10:15:00.000Z",
              pricingTrace: {},
              legs: [
                {
                  idx: 1,
                  fromCurrency: "USD",
                  toCurrency: "EUR",
                  fromAmountMinor: "100000",
                  toAmountMinor: "91500",
                  rateNum: "915",
                  rateDen: "1000",
                  sourceKind: "bank",
                  sourceRef: null,
                  asOf: "2026-03-27T10:00:00.000Z",
                  executionCounterpartyId: null,
                },
              ],
              financialLines: [],
              snapshotHash:
                "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            },
          },
          title: "Казначейский FX",
          occurredAt: "2026-03-27T10:00:00.000Z",
          submissionStatus: "submitted",
          approvalStatus: "not_required",
          postingStatus: "posted",
          lifecycleStatus: "active",
          allowedActions: [],
          createIdempotencyKey: null,
          amount: "1000",
          currency: "USD",
          memo: "memo",
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
          postedAt: "2026-03-27T10:01:00.000Z",
          postingError: null,
          createdAt: "2026-03-27T10:00:00.000Z",
          updatedAt: "2026-03-27T10:00:00.000Z",
          version: 1,
          postingOperationId: "00000000-0000-4000-8000-000000000999",
        },
        links: [],
        parent: null,
        children: [],
        dependsOn: [],
        compensates: [],
        documentOperations: [],
        ledgerOperations: [],
      },
      organizationLabels: {
        "00000000-0000-4000-8000-000000000201": "Multihansa",
        "00000000-0000-4000-8000-000000000202": "Vedex",
      },
      sourceRequisiteLabel: "Multihansa USD",
      destinationRequisiteLabel: "Vedex EUR",
    });

    expect(view).not.toBeNull();
    expect(view?.docNo).toBe("FX-301");
    expect(view?.href).toBe(
      "/documents/ifrs/fx_execute/00000000-0000-4000-8000-000000000301",
    );
    expect(view?.statusBadges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Статус", value: "Отправлен" }),
        expect.objectContaining({ label: "Учет", value: "Проведен" }),
      ]),
    );
    expect(view?.summary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Execution ref", value: "FX-EXEC-301" }),
        expect.objectContaining({ label: "Ownership mode", value: "Между организациями" }),
        expect.objectContaining({
          label: "Источник",
          value: "Multihansa · Multihansa USD",
        }),
        expect.objectContaining({
          label: "Назначение",
          value: "Vedex · Vedex EUR",
        }),
      ]),
    );
    expect(view?.postingOperationId).toBe(
      "00000000-0000-4000-8000-000000000999",
    );

    expect(
      presentFxQuoteStage({
        quote: {
          status: "used",
          usedByRef: "fx_execute:00000000-0000-4000-8000-000000000301",
        },
        linkedDocument: {
          ...({
            document: {
              ...{
                id: "00000000-0000-4000-8000-000000000301",
                docType: "fx_execute",
                docNo: "FX-301",
                payloadVersion: 1,
                payload: {},
                title: "Казначейский FX",
                occurredAt: "2026-03-27T10:00:00.000Z",
                submissionStatus: "submitted",
                approvalStatus: "not_required",
                postingStatus: "posted",
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
                postedAt: "2026-03-27T10:01:00.000Z",
                postingError: null,
                createdAt: "2026-03-27T10:00:00.000Z",
                updatedAt: "2026-03-27T10:00:00.000Z",
                version: 1,
                postingOperationId: "00000000-0000-4000-8000-000000000999",
              },
            },
            links: [],
            parent: null,
            children: [],
            dependsOn: [],
            compensates: [],
            documentOperations: [],
            ledgerOperations: [],
          }),
        },
      }),
    ).toEqual({
      badgeLabel: "FX завершен",
      badgeVariant: "success",
      title: "FX документ проведен",
      description:
        "Котировка использована, supporting FX документ оформлен и уже зафиксирован в учете.",
      nextAction:
        "Дополнительных действий не требуется, кроме проверки журнала или документа при аудите.",
      contextLabel: "Связанный документ: FX-301",
    });
  });
});
