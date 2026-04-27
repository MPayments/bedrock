import { describe, expect, it } from "vitest";

import {
  AcceptancePayloadSchema,
  InvoiceInputSchema,
} from "../src/validation";

const CUSTOMER_ID = "00000000-0000-4000-8000-000000000001";
const COUNTERPARTY_ID = "00000000-0000-4000-8000-000000000002";
const ORGANIZATION_ID = "00000000-0000-4000-8000-000000000003";
const REQUISITE_ID = "00000000-0000-4000-8000-000000000004";
const INVOICE_DOCUMENT_ID = "00000000-0000-4000-8000-000000000005";
const EXCHANGE_DOCUMENT_ID = "00000000-0000-4000-8000-000000000006";

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

  it("keeps acceptance payload compatible with optional exchange linkage", () => {
    const withoutExchange = AcceptancePayloadSchema.parse({
      occurredAt: "2026-03-03T10:00:00.000Z",
      invoiceDocumentId: INVOICE_DOCUMENT_ID,
      memo: "close direct invoice",
    });
    const withExchange = AcceptancePayloadSchema.parse({
      occurredAt: "2026-03-03T10:00:00.000Z",
      invoiceDocumentId: INVOICE_DOCUMENT_ID,
      exchangeDocumentId: EXCHANGE_DOCUMENT_ID,
      memo: "close fx invoice",
    });

    expect(withoutExchange.exchangeDocumentId).toBeUndefined();
    expect(withExchange.exchangeDocumentId).toBe(EXCHANGE_DOCUMENT_ID);
  });
});
