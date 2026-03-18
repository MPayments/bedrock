import { describe, expect, it } from "vitest";

import {
  AcceptancePayloadSchema,
  InvoiceInputSchema,
  compileInvoiceDirectFinancialLines,
} from "../src/validation";

const CUSTOMER_ID = "00000000-0000-4000-8000-000000000001";
const COUNTERPARTY_ID = "00000000-0000-4000-8000-000000000002";
const ORGANIZATION_ID = "00000000-0000-4000-8000-000000000003";
const REQUISITE_ID = "00000000-0000-4000-8000-000000000004";
const INVOICE_DOCUMENT_ID = "00000000-0000-4000-8000-000000000005";
const EXCHANGE_DOCUMENT_ID = "00000000-0000-4000-8000-000000000006";

describe("commercial documents validation", () => {
  it("accepts direct invoice input with fixed and percent authoring rows", () => {
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
          calcMethod: "fixed",
          bucket: "fee_revenue",
          currency: "rub",
          amount: "10.25",
          memo: "service fee",
        },
        {
          calcMethod: "percent",
          bucket: "pass_through",
          currency: "usd",
          percent: "-1.5",
        },
      ],
    });

    expect(parsed).toMatchObject({
      mode: "direct",
      amountMinor: "100050",
      currency: "USD",
    });
    expect(parsed.financialLines).toHaveLength(2);
    expect(parsed.financialLines[0]).toMatchObject({
      calcMethod: "fixed",
      bucket: "fee_revenue",
      currency: "RUB",
      amount: "10.25",
      memo: "service fee",
    });
    expect(parsed.financialLines[1]).toMatchObject({
      calcMethod: "percent",
      bucket: "pass_through",
      currency: "USD",
      percent: "-1.5",
    });

    expect(
      compileInvoiceDirectFinancialLines({
        financialLines: parsed.financialLines,
        amountMinor: parsed.amountMinor,
        currency: parsed.currency,
      }),
    ).toMatchObject([
      {
        calcMethod: "fixed",
        bucket: "fee_revenue",
        currency: "RUB",
        amount: "10.25",
        amountMinor: "1025",
        source: "manual",
        settlementMode: "in_ledger",
        memo: "service fee",
      },
      {
        calcMethod: "percent",
        percentBps: -150,
        bucket: "pass_through",
        currency: "USD",
        amountMinor: "-1500",
        source: "manual",
        settlementMode: "separate_payment_order",
      },
    ]);
  });

  it("rejects percent rows that resolve to zero or mismatch invoice currency", () => {
    expect(() =>
      InvoiceInputSchema.parse({
        mode: "direct",
        occurredAt: "2026-03-03T10:00:00.000Z",
        customerId: CUSTOMER_ID,
        counterpartyId: COUNTERPARTY_ID,
        organizationId: ORGANIZATION_ID,
        organizationRequisiteId: REQUISITE_ID,
        amount: "0.01",
        currency: "usd",
        financialLines: [
          {
            calcMethod: "percent",
            bucket: "fee_revenue",
            currency: "usd",
            percent: "0.01",
          },
        ],
      }),
    ).toThrow("percent-based financial line must not resolve to zero");

    expect(() =>
      InvoiceInputSchema.parse({
        mode: "direct",
        occurredAt: "2026-03-03T10:00:00.000Z",
        customerId: CUSTOMER_ID,
        counterpartyId: COUNTERPARTY_ID,
        organizationId: ORGANIZATION_ID,
        organizationRequisiteId: REQUISITE_ID,
        amount: "100.00",
        currency: "usd",
        financialLines: [
          {
            calcMethod: "percent",
            bucket: "fee_revenue",
            currency: "eur",
            percent: "1.25",
          },
        ],
      }),
    ).toThrow("percent-based financial line currency must match base currency USD");
  });

  it("keeps payload parsing compatible with percent metadata", () => {
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
        },
      ],
    });

    const [compiled] = compileInvoiceDirectFinancialLines({
      financialLines: parsed.financialLines,
      amountMinor: parsed.amountMinor,
      currency: parsed.currency,
    });

    expect(compiled).toMatchObject({
      calcMethod: "fixed",
      amountMinor: "1025",
    });
  });

  it("accepts legacy exchange invoice input with quoteRef", () => {
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

  it("accepts generated exchange invoice input without quoteRef", () => {
    const parsed = InvoiceInputSchema.parse({
      mode: "exchange",
      occurredAt: "2026-03-03T10:00:00.000Z",
      customerId: CUSTOMER_ID,
      counterpartyId: COUNTERPARTY_ID,
      organizationId: ORGANIZATION_ID,
      organizationRequisiteId: REQUISITE_ID,
      amount: "100.50",
      currency: "usd",
      targetCurrency: "eur",
      memo: "fx invoice",
    });

    expect(parsed).toMatchObject({
      mode: "exchange",
      amount: "100.5",
      amountMinor: "10050",
      currency: "USD",
      targetCurrency: "EUR",
      memo: "fx invoice",
    });
    expect(parsed.quoteRef).toBeUndefined();
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
