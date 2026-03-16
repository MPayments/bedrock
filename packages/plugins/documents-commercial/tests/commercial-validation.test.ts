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
  it("accepts direct invoice input and maps signed financial lines", () => {
    const parsed = InvoiceInputSchema.parse({
      mode: "direct",
      occurredAt: "2026-03-03T10:00:00.000Z",
      customerId: CUSTOMER_ID,
      counterpartyId: COUNTERPARTY_ID,
      organizationId: ORGANIZATION_ID,
      organizationRequisiteId: REQUISITE_ID,
      amount: "1000.50",
      currency: "usd",
      financialLines: [
        {
          bucket: "fee_revenue",
          currency: "rub",
          amount: "10.25",
          memo: "service fee",
        },
        {
          bucket: "pass_through",
          currency: "eur",
          amount: "-1.5",
        },
      ],
    });

    expect(parsed).toMatchObject({
      mode: "direct",
      amountMinor: "100050",
      currency: "USD",
    });
    expect(parsed.financialLines).toHaveLength(2);
    expect(parsed.financialLines[0]?.id).toMatch(/^manual:/);
    expect(parsed.financialLines[0]).toMatchObject({
      bucket: "fee_revenue",
      currency: "RUB",
      amount: "10.25",
      amountMinor: "1025",
      source: "manual",
      settlementMode: "in_ledger",
      memo: "service fee",
    });
    expect(parsed.financialLines[1]).toMatchObject({
      bucket: "pass_through",
      currency: "EUR",
      amount: "-1.5",
      amountMinor: "-150",
      source: "manual",
      settlementMode: "separate_payment_order",
    });
  });

  it("accepts exchange invoice input without direct amount fields", () => {
    const parsed = InvoiceInputSchema.parse({
      mode: "exchange",
      occurredAt: "2026-03-03T10:00:00.000Z",
      customerId: CUSTOMER_ID,
      counterpartyId: COUNTERPARTY_ID,
      organizationId: ORGANIZATION_ID,
      organizationRequisiteId: REQUISITE_ID,
      quoteRef: "quote-ref-1",
      memo: "fx invoice",
    });

    expect(parsed).toMatchObject({
      mode: "exchange",
      quoteRef: "quote-ref-1",
      memo: "fx invoice",
    });
    expect("amountMinor" in parsed).toBe(false);
  });

  it("keeps acceptance payload compatible with optional exchange linkage", () => {
    const withoutExchange = AcceptancePayloadSchema.parse({
      occurredAt: "2026-03-03T10:00:00.000Z",
      invoiceDocumentId: INVOICE_DOCUMENT_ID,
      invoiceMode: "direct",
      memo: "close direct invoice",
    });
    const withExchange = AcceptancePayloadSchema.parse({
      occurredAt: "2026-03-03T10:00:00.000Z",
      invoiceDocumentId: INVOICE_DOCUMENT_ID,
      exchangeDocumentId: EXCHANGE_DOCUMENT_ID,
      invoiceMode: "exchange",
      memo: "close fx invoice",
    });

    expect(withoutExchange.exchangeDocumentId).toBeUndefined();
    expect(withExchange.exchangeDocumentId).toBe(EXCHANGE_DOCUMENT_ID);
  });
});
