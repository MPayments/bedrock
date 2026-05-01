import { describe, expect, it } from "vitest";

import {
  AcceptancePayloadSchema,
  ApplicationInputSchema,
  InvoiceInputSchema,
} from "../src/validation";

const CUSTOMER_ID = "00000000-0000-4000-8000-000000000001";
const COUNTERPARTY_ID = "00000000-0000-4000-8000-000000000002";
const ORGANIZATION_ID = "00000000-0000-4000-8000-000000000003";
const REQUISITE_ID = "00000000-0000-4000-8000-000000000004";
const INVOICE_DOCUMENT_ID = "00000000-0000-4000-8000-000000000005";
const APPLICATION_DOCUMENT_ID = "00000000-0000-4000-8000-000000000006";
const DEAL_ID = "00000000-0000-4000-8000-000000000007";
const QUOTE_ID = "00000000-0000-4000-8000-000000000008";
const CALCULATION_ID = "00000000-0000-4000-8000-000000000009";
const EVIDENCE_ID = "00000000-0000-4000-8000-000000000010";

describe("commercial documents validation", () => {
  it("accepts current single-currency invoice input", () => {
    const parsed = InvoiceInputSchema.parse({
      occurredAt: "2026-03-03T10:00:00.000Z",
      customerId: CUSTOMER_ID,
      counterpartyId: COUNTERPARTY_ID,
      organizationId: ORGANIZATION_ID,
      organizationRequisiteId: REQUISITE_ID,
      amount: "100.50",
      currency: "usd",
      memo: "fx invoice",
    });

    expect(parsed).toMatchObject({
      amount: "100.5",
      amountMinor: "10050",
      currency: "USD",
      memo: "fx invoice",
    });
  });

  it("accepts application input for a deal-scoped поручение", () => {
    const parsed = ApplicationInputSchema.parse({
      occurredAt: "2026-03-03T10:00:00.000Z",
      dealId: DEAL_ID,
      quoteId: QUOTE_ID,
      calculationId: CALCULATION_ID,
      customerId: CUSTOMER_ID,
      counterpartyId: COUNTERPARTY_ID,
      organizationId: ORGANIZATION_ID,
      organizationRequisiteId: REQUISITE_ID,
      memo: "application",
    });

    expect(parsed).toMatchObject({
      calculationId: CALCULATION_ID,
      dealId: DEAL_ID,
      quoteId: QUOTE_ID,
    });
  });

  it("keeps acceptance payload tied to application with optional invoice evidence", () => {
    const withoutInvoice = AcceptancePayloadSchema.parse({
      occurredAt: "2026-03-03T10:00:00.000Z",
      applicationDocumentId: APPLICATION_DOCUMENT_ID,
      memo: "close direct payout",
    });
    const withInvoice = AcceptancePayloadSchema.parse({
      occurredAt: "2026-03-03T10:00:00.000Z",
      applicationDocumentId: APPLICATION_DOCUMENT_ID,
      invoiceDocumentId: INVOICE_DOCUMENT_ID,
      settlementEvidenceFileAssetIds: [EVIDENCE_ID],
      memo: "close fx invoice",
    });

    expect(withoutInvoice.invoiceDocumentId).toBeUndefined();
    expect(withoutInvoice.settlementEvidenceFileAssetIds).toEqual([]);
    expect(withInvoice.invoiceDocumentId).toBe(INVOICE_DOCUMENT_ID);
    expect(withInvoice.settlementEvidenceFileAssetIds).toEqual([EVIDENCE_ID]);
  });
});
