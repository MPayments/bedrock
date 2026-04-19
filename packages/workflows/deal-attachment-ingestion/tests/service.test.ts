import { describe, expect, it, vi } from "vitest";

import type { DealIntakeDraft } from "@bedrock/deals/contracts";

import {
  createDealAttachmentIngestionWorkflow,
  mergeNormalizedPayloadIntoIntake,
} from "../src";

function createPaymentIntake(): DealIntakeDraft {
  return {
    common: {
      applicantCounterpartyId: "00000000-0000-4000-8000-000000000111",
      customerNote: null,
      requestedExecutionDate: new Date("2026-04-02T00:00:00.000Z"),
    },
    externalBeneficiary: {
      bankInstructionSnapshot: null,
      beneficiaryCounterpartyId: null,
      beneficiarySnapshot: null,
    },
    incomingReceipt: {
      contractNumber: null,
      expectedAmount: null,
      expectedAt: null,
      invoiceNumber: null,
      payerCounterpartyId: null,
      payerSnapshot: null,
    },
    moneyRequest: {
      purpose: null,
      sourceAmount: null,
      sourceCurrencyId: null,
      targetCurrencyId: null,
    },
    settlementDestination: {
      bankInstructionSnapshot: null,
      mode: null,
      requisiteId: null,
    },
    type: "payment",
  };
}

describe("mergeNormalizedPayloadIntoIntake", () => {
  it("maps invoice data into payment target-side fields without overwriting source-side input", () => {
    const intake = createPaymentIntake();
    intake.moneyRequest.purpose = "Оплатить поставщику";
    intake.moneyRequest.sourceCurrencyId = "00000000-0000-4000-8000-000000000100";

    const result = mergeNormalizedPayloadIntoIntake({
      intake,
      normalizedPayload: {
        amount: "1000.50",
        bankInstructionSnapshot: {
          accountNo: "40702810900000000001",
          bankAddress: null,
          bankCountry: "CN",
          bankName: "Bank of Shanghai",
          beneficiaryName: "Shanghai Supplier Co",
          bic: null,
          iban: null,
          label: null,
          swift: "BOSHSH22",
        },
        beneficiarySnapshot: {
          country: "CN",
          displayName: "Shanghai Supplier",
          inn: null,
          legalName: "Shanghai Supplier Co Ltd",
        },
        contractNumber: "CTR-2026-01",
        currencyCode: "USD",
        currencyId: "00000000-0000-4000-8000-000000000210",
        documentPurpose: "invoice",
        invoiceNumber: "INV-2026-77",
        paymentPurpose: "Invoice payment",
      },
      purpose: "invoice",
    });

    expect(result.changed).toBe(true);
    expect(result.intake.incomingReceipt.invoiceNumber).toBe("INV-2026-77");
    expect(result.intake.incomingReceipt.expectedAmount).toBe("1000.50");
    expect(result.intake.moneyRequest.sourceAmount).toBeNull();
    expect(result.intake.moneyRequest.sourceCurrencyId).toBe(
      "00000000-0000-4000-8000-000000000100",
    );
    expect(result.intake.moneyRequest.targetCurrencyId).toBe(
      "00000000-0000-4000-8000-000000000210",
    );
    expect(result.intake.moneyRequest.purpose).toBe("Оплатить поставщику");
    expect(result.skippedFields).toContain("moneyRequest.purpose");
    expect(result.intake.externalBeneficiary.beneficiarySnapshot?.legalName).toBe(
      "Shanghai Supplier Co Ltd",
    );
  });

  it("fills only contract number for contract purpose", () => {
    const result = mergeNormalizedPayloadIntoIntake({
      intake: createPaymentIntake(),
      normalizedPayload: {
        amount: "1000",
        bankInstructionSnapshot: null,
        beneficiarySnapshot: null,
        contractNumber: "CTR-42",
        currencyCode: "USD",
        currencyId: "00000000-0000-4000-8000-000000000210",
        documentPurpose: "contract",
        invoiceNumber: "INV-42",
        paymentPurpose: "Contract payment",
      },
      purpose: "contract",
    });

    expect(result.appliedFields).toEqual(["incomingReceipt.contractNumber"]);
    expect(result.intake.incomingReceipt.contractNumber).toBe("CTR-42");
    expect(result.intake.incomingReceipt.invoiceNumber).toBeNull();
    expect(result.intake.moneyRequest.sourceAmount).toBeNull();
  });
});

describe("createDealAttachmentIngestionWorkflow", () => {
  it("does not enqueue ineligible attachments", async () => {
    const workflow = createDealAttachmentIngestionWorkflow({
      currencies: {
        findByCode: vi.fn(),
      } as any,
      deals: {
        deals: {
          commands: {
            enqueueAttachmentIngestion: vi.fn(),
          },
          queries: {
            findWorkflowById: vi.fn(async () => ({
              summary: { type: "payment" },
            })),
          },
        },
      } as any,
      files: {
        files: {
          queries: {
            listDealAttachments: vi.fn(async () => [
              {
                id: "attachment-1",
                mimeType: "image/png",
                purpose: "other",
              },
            ]),
          },
        },
      } as any,
    });

    await expect(
      workflow.enqueueIfEligible({
        dealId: "deal-1",
        fileAssetId: "attachment-1",
      }),
    ).resolves.toBeNull();
  });
});
