import { describe, expect, it } from "vitest";

import {
  IncomingInvoiceInputSchema,
  OutgoingInvoiceInputSchema,
  PaymentOrderExecutionStatusSchema,
  PaymentOrderInputSchema,
  PaymentOrderPayloadSchema,
} from "../src/validation";

const CUSTOMER_ID = "00000000-0000-4000-8000-000000000001";
const COUNTERPARTY_ID = "00000000-0000-4000-8000-000000000002";
const ORGANIZATION_ID = "00000000-0000-4000-8000-000000000003";
const REQUISITE_ID = "00000000-0000-4000-8000-000000000004";
const INCOMING_INVOICE_DOCUMENT_ID = "00000000-0000-4000-8000-000000000005";
const COUNTERPARTY_REQUISITE_ID = "00000000-0000-4000-8000-000000000006";

describe("commercial documents validation", () => {
  it("accepts incoming_invoice input with external basis metadata", () => {
    const parsed = IncomingInvoiceInputSchema.parse({
      contour: "intl",
      occurredAt: "2026-03-03T10:00:00.000Z",
      customerId: CUSTOMER_ID,
      counterpartyId: COUNTERPARTY_ID,
      organizationId: ORGANIZATION_ID,
      organizationRequisiteId: REQUISITE_ID,
      amount: "1000.50",
      currency: "usd",
      externalBasis: {
        sourceSystem: "crm",
        entityType: "deal",
        entityId: "deal-42",
      },
    });

    expect(parsed).toMatchObject({
      contour: "intl",
      amountMinor: "100050",
      currency: "USD",
      externalBasis: {
        sourceSystem: "crm",
        entityType: "deal",
        entityId: "deal-42",
        documentNumber: null,
      },
    });
  });

  it("accepts outgoing_invoice input and normalizes currency/amount", () => {
    const parsed = OutgoingInvoiceInputSchema.parse({
      contour: "rf",
      occurredAt: "2026-03-03T10:00:00.000Z",
      counterpartyId: COUNTERPARTY_ID,
      counterpartyRequisiteId: COUNTERPARTY_REQUISITE_ID,
      organizationId: ORGANIZATION_ID,
      organizationRequisiteId: REQUISITE_ID,
      amount: "200.25",
      currency: "eur",
    });

    expect(parsed).toMatchObject({
      contour: "rf",
      amountMinor: "20025",
      currency: "EUR",
    });
  });

  it("accepts payment_order input with execution status default", () => {
    const parsed = PaymentOrderInputSchema.parse({
      contour: "intl",
      occurredAt: "2026-03-03T10:00:00.000Z",
      incomingInvoiceDocumentId: INCOMING_INVOICE_DOCUMENT_ID,
      counterpartyId: COUNTERPARTY_ID,
      counterpartyRequisiteId: COUNTERPARTY_REQUISITE_ID,
      organizationId: ORGANIZATION_ID,
      organizationRequisiteId: REQUISITE_ID,
      amount: "10.50",
      currency: "usd",
      allocatedCurrency: "eur",
    });

    expect(parsed).toMatchObject({
      contour: "intl",
      amountMinor: "1050",
      currency: "USD",
      allocatedCurrency: "EUR",
      executionStatus: "sent",
    });
  });

  it("accepts payment_order resolution input with a source payment order reference", () => {
    const parsed = PaymentOrderInputSchema.parse({
      contour: "intl",
      occurredAt: "2026-03-03T10:00:00.000Z",
      incomingInvoiceDocumentId: INCOMING_INVOICE_DOCUMENT_ID,
      sourcePaymentOrderDocumentId:
        "00000000-0000-4000-8000-000000000007",
      counterpartyId: COUNTERPARTY_ID,
      counterpartyRequisiteId: COUNTERPARTY_REQUISITE_ID,
      organizationId: ORGANIZATION_ID,
      organizationRequisiteId: REQUISITE_ID,
      amount: "10.50",
      currency: "usd",
      allocatedCurrency: "eur",
      executionStatus: "failed",
    });

    expect(parsed).toMatchObject({
      sourcePaymentOrderDocumentId: "00000000-0000-4000-8000-000000000007",
      executionStatus: "failed",
    });
  });

  it("keeps payment_order payload compatible with FX quote snapshots", () => {
    const parsed = PaymentOrderPayloadSchema.parse({
      contour: "intl",
      occurredAt: "2026-03-03T10:00:00.000Z",
      incomingInvoiceDocumentId: INCOMING_INVOICE_DOCUMENT_ID,
      sourcePaymentOrderDocumentId: "00000000-0000-4000-8000-000000000007",
      customerId: CUSTOMER_ID,
      counterpartyId: COUNTERPARTY_ID,
      counterpartyRequisiteId: COUNTERPARTY_REQUISITE_ID,
      organizationId: ORGANIZATION_ID,
      organizationRequisiteId: REQUISITE_ID,
      fundingAmount: "100.00",
      fundingAmountMinor: "10000",
      fundingCurrency: "USD",
      allocatedAmount: "92.00",
      allocatedAmountMinor: "9200",
      allocatedCurrency: "EUR",
      executionStatus: "settled",
      quoteSnapshot: {
        quoteId: "00000000-0000-4000-8000-000000000010",
        quoteRef: "quote-ref-1",
        idempotencyKey: "quote-ref-1",
        fromCurrency: "USD",
        toCurrency: "EUR",
        fromAmountMinor: "10000",
        toAmountMinor: "9200",
        pricingMode: "explicit_route",
        rateNum: "23",
        rateDen: "25",
        expiresAt: "2026-03-03T10:10:00.000Z",
        pricingTrace: { version: "v1" },
        legs: [
          {
            idx: 1,
            fromCurrency: "USD",
            toCurrency: "EUR",
            fromAmountMinor: "10000",
            toAmountMinor: "9200",
            rateNum: "23",
            rateDen: "25",
            sourceKind: "manual",
            sourceRef: "desk",
            asOf: "2026-03-03T10:00:00.000Z",
            executionCounterpartyId: null,
          },
        ],
        financialLines: [],
        snapshotHash:
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      },
    });

    expect(parsed.quoteSnapshot?.toAmountMinor).toBe("9200");
    expect(parsed.executionStatus).toBe("settled");
    expect(parsed.sourcePaymentOrderDocumentId).toBe(
      "00000000-0000-4000-8000-000000000007",
    );
  });

  it("supports the full execution status enum", () => {
    expect(PaymentOrderExecutionStatusSchema.options).toEqual([
      "prepared",
      "sent",
      "settled",
      "void",
      "failed",
    ]);
  });
});
