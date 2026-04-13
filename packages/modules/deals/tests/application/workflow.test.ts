import { describe, expect, it } from "vitest";

import {
  buildEffectiveDealExecutionPlan,
  deriveDealNextAction,
  evaluateDealSectionCompleteness,
} from "../../src/domain/workflow";

describe("deal workflow", () => {
  it("does not require money request purpose for payment deals", () => {
    const completeness = evaluateDealSectionCompleteness({
      common: {
        applicantCounterpartyId: "applicant-1",
        customerNote: null,
        requestedExecutionDate: new Date("2026-04-05T00:00:00.000Z"),
      },
      externalBeneficiary: {
        bankInstructionSnapshot: {
          accountNo: "DE89370400440532013000",
          bankAddress: null,
          bankCountry: "DE",
          bankName: "Beneficiary Bank",
          beneficiaryName: "Beneficiary GmbH",
          bic: "DEUTDEFF",
          corrAccount: null,
          iban: "DE89370400440532013000",
          label: "Main payout bank",
          swift: "DEUTDEFF",
        },
        beneficiaryCounterpartyId: "beneficiary-1",
        beneficiarySnapshot: null,
      },
      incomingReceipt: {
        contractNumber: null,
        expectedAmount: "1000.00",
        expectedAt: null,
        expectedCurrencyId: "currency-2",
        invoiceNumber: null,
        payerCounterpartyId: null,
        payerSnapshot: null,
      },
      moneyRequest: {
        purpose: null,
        sourceAmount: null,
        sourceCurrencyId: "currency-1",
        targetCurrencyId: "currency-2",
      },
      settlementDestination: {
        bankInstructionSnapshot: null,
        mode: null,
        requisiteId: null,
      },
      type: "payment",
    });

    expect(completeness.find((section) => section.sectionId === "moneyRequest"))
      .toEqual({
        blockingReasons: [],
        complete: true,
        sectionId: "moneyRequest",
      });
  });

  it("uses the nearest transition blockers when deriving next action", () => {
    const nextAction = deriveDealNextAction({
      acceptance: {
        acceptedAt: new Date("2026-04-05T08:55:08.683Z"),
        acceptedByUserId: "user-1",
        agreementVersionId: null,
        dealId: "deal-1",
        dealRevision: 3,
        expiresAt: new Date("2026-04-06T08:54:00.000Z"),
        id: "acceptance-1",
        quoteId: "quote-1",
        quoteStatus: "used",
        replacedByQuoteId: null,
        revokedAt: null,
        usedAt: new Date("2026-04-05T08:57:22.536Z"),
        usedDocumentId: "doc-1",
      },
      calculationId: "calculation-1",
      completeness: [
        {
          blockingReasons: [],
          complete: true,
          sectionId: "common",
        },
        {
          blockingReasons: [],
          complete: true,
          sectionId: "moneyRequest",
        },
        {
          blockingReasons: [],
          complete: true,
          sectionId: "externalBeneficiary",
        },
      ],
      intake: {
        common: {
          applicantCounterpartyId: "applicant-1",
          customerNote: null,
          requestedExecutionDate: new Date("2026-04-05T00:00:00.000Z"),
        },
        externalBeneficiary: {
          bankInstructionSnapshot: {
            accountNo: "DE89370400440532013000",
            bankAddress: null,
            bankCountry: "DE",
            bankName: "Beneficiary Bank",
            beneficiaryName: "Beneficiary GmbH",
            bic: "DEUTDEFF",
            corrAccount: null,
            iban: "DE89370400440532013000",
            label: "Main payout bank",
            swift: "DEUTDEFF",
          },
          beneficiaryCounterpartyId: "beneficiary-1",
          beneficiarySnapshot: null,
        },
        incomingReceipt: {
          contractNumber: null,
          expectedAmount: "1000.00",
          expectedAt: null,
          expectedCurrencyId: "currency-2",
          invoiceNumber: null,
          payerCounterpartyId: null,
          payerSnapshot: null,
        },
        moneyRequest: {
          purpose: null,
          sourceAmount: null,
          sourceCurrencyId: "currency-1",
          targetCurrencyId: "currency-2",
        },
        settlementDestination: {
          bankInstructionSnapshot: null,
          mode: null,
          requisiteId: null,
        },
        type: "payment",
      },
      status: "preparing_documents",
      transitionReadiness: [
        {
          allowed: true,
          blockers: [],
          targetStatus: "awaiting_funds",
        },
        {
          allowed: false,
          blockers: [
            {
              code: "operational_position_incomplete",
              message: "Operational position is not ready: customer_receivable",
            },
          ],
          targetStatus: "awaiting_payment",
        },
      ],
    });

    expect(nextAction).toBe("Continue processing");
  });

  it("marks the payment convert leg done after a posted exchange document exists", () => {
    const executionPlan = buildEffectiveDealExecutionPlan({
      acceptance: null,
      documents: [
        {
          approvalStatus: "not_required",
          createdAt: new Date("2026-04-05T09:00:00.000Z"),
          docType: "exchange",
          id: "document-1",
          lifecycleStatus: "active",
          occurredAt: new Date("2026-04-05T09:00:00.000Z"),
          postingStatus: "posted",
          submissionStatus: "submitted",
        },
      ],
      fundingResolution: {
        availableMinor: "1450000",
        fundingOrganizationId: "00000000-0000-4000-8000-000000000001",
        fundingRequisiteId: "00000000-0000-4000-8000-000000000002",
        reasonCode: null,
        requiredAmountMinor: "1450000",
        state: "resolved",
        strategy: "external_fx",
        targetCurrency: "USD",
        targetCurrencyId: "00000000-0000-4000-8000-000000000003",
      },
      intake: {
        common: {
          applicantCounterpartyId: "applicant-1",
          customerNote: null,
          requestedExecutionDate: new Date("2026-04-05T00:00:00.000Z"),
        },
        externalBeneficiary: {
          bankInstructionSnapshot: {
            accountNo: "AE640970000000103000009876543210",
            bankAddress: null,
            bankCountry: "AE",
            bankName: "Dubai Islamic Bank",
            beneficiaryName: "ALMUTLAG GENERAL TRADING LLC",
            bic: "DUIBAEAD",
            corrAccount: null,
            iban: "AE640970000000103000009876543210",
            label: "Primary beneficiary account",
            swift: "DUIBAEAD",
          },
          beneficiaryCounterpartyId: "beneficiary-1",
          beneficiarySnapshot: null,
        },
        incomingReceipt: {
          contractNumber: "WP-PO-2026-001",
          expectedAmount: "14500.00",
          expectedAt: null,
          expectedCurrencyId: "currency-usd",
          invoiceNumber: "WP-INV-2026-001",
          payerCounterpartyId: "payer-1",
          payerSnapshot: null,
        },
        moneyRequest: {
          purpose: "Payment for invoice WP-INV-2026-001",
          sourceAmount: "14500.00",
          sourceCurrencyId: "currency-aed",
          targetCurrencyId: "currency-usd",
        },
        settlementDestination: {
          bankInstructionSnapshot: null,
          mode: null,
          requisiteId: null,
        },
        type: "payment",
      },
      now: new Date("2026-04-05T10:00:00.000Z"),
      storedLegs: [],
    });

    expect(executionPlan.find((leg) => leg.kind === "convert")?.state).toBe(
      "done",
    );
  });
});
