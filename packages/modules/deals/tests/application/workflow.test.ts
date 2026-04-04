import { describe, expect, it } from "vitest";

import { evaluateDealSectionCompleteness } from "../../src/domain/workflow";

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
});
