import { describe, expect, it, vi } from "vitest";

import type { DealHeader } from "@bedrock/deals/contracts";

import {
  createDealAttachmentIngestionWorkflow,
  mergeNormalizedPayloadIntoHeader,
} from "../src";

function createPaymentHeader(): DealHeader {
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
      expectedCurrencyId: null,
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

describe("mergeNormalizedPayloadIntoHeader", () => {
  it("maps invoice data into payment target-side fields without overwriting source-side input", () => {
    const header = createPaymentHeader();
    header.moneyRequest.purpose = "Оплатить поставщику";
    header.moneyRequest.sourceCurrencyId = "00000000-0000-4000-8000-000000000100";

    const result = mergeNormalizedPayloadIntoHeader({
      header,
      normalizedPayload: {
        amount: "1000.50",
        bankInstructionSnapshot: {
          accountNo: "40702810900000000001",
          bankAddress: null,
          bankCountry: "CN",
          bankName: "Bank of Shanghai",
          beneficiaryName: "Shanghai Supplier Co",
          bic: null,
          corrAccount: null,
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
    expect(result.header.incomingReceipt.invoiceNumber).toBe("INV-2026-77");
    expect(result.header.incomingReceipt.expectedAmount).toBe("1000.50");
    expect(result.header.moneyRequest.sourceAmount).toBeNull();
    expect(result.header.moneyRequest.sourceCurrencyId).toBe(
      "00000000-0000-4000-8000-000000000100",
    );
    expect(result.header.moneyRequest.targetCurrencyId).toBe(
      "00000000-0000-4000-8000-000000000210",
    );
    expect(result.header.moneyRequest.purpose).toBe("Оплатить поставщику");
    expect(result.skippedFields).toContain("moneyRequest.purpose");
    expect(result.header.externalBeneficiary.beneficiarySnapshot?.legalName).toBe(
      "Shanghai Supplier Co Ltd",
    );
  });

  it("fills only contract number for contract purpose", () => {
    const result = mergeNormalizedPayloadIntoHeader({
      header: createPaymentHeader(),
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
    expect(result.header.incomingReceipt.contractNumber).toBe("CTR-42");
    expect(result.header.incomingReceipt.invoiceNumber).toBeNull();
    expect(result.header.moneyRequest.sourceAmount).toBeNull();
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
