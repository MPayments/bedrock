import { describe, expect, it, vi } from "vitest";

import { ACCOUNTING_SOURCE_ID } from "@bedrock/accounting/posting-contracts";

import {
  COMMERCIAL_DOCUMENT_TYPE_ORDER,
  createCommercialDocumentModules,
} from "../src";

function createDeps() {
  return {
    documentRelations: {
      loadIncomingInvoice: vi.fn(),
      loadPaymentOrder: vi.fn(),
      listIncomingInvoicePaymentOrders: vi.fn(async () => []),
      listPaymentOrderResolutions: vi.fn(async () => []),
    },
    ledgerRead: {
      getOperationDetails: vi.fn(async () => null),
    },
    quoteSnapshot: {
      loadQuoteSnapshot: vi.fn(),
      createQuoteSnapshot: vi.fn(),
    },
    quoteUsage: {
      markQuoteUsedForPaymentOrder: vi.fn(),
    },
    requisiteBindings: {
      resolveBinding: vi.fn(),
    },
    partyReferences: {
      assertCustomerExists: vi.fn(),
      assertCounterpartyExists: vi.fn(),
      assertCounterpartyLinkedToCustomer: vi.fn(),
    },
    treasuryState: {
      ensureIncomingInvoiceObligation: vi.fn(),
      ensureOutgoingInvoiceObligation: vi.fn(),
      ensurePaymentOrderPayout: vi.fn(),
      listDocumentLinks: vi.fn(async () => []),
      getPaymentOrderStatus: vi.fn(async () => null),
    },
  };
}

describe("commercial module registry", () => {
  it("registers one module per commercial doc type in canonical order", () => {
    const modules = createCommercialDocumentModules(createDeps() as any);

    expect(modules).toHaveLength(COMMERCIAL_DOCUMENT_TYPE_ORDER.length);
    expect(modules.map((module) => module.docType)).toEqual(
      COMMERCIAL_DOCUMENT_TYPE_ORDER,
    );
  });

  it("exposes the expected posting model for incoming_invoice, payment_order, and outgoing_invoice", () => {
    const modules = createCommercialDocumentModules(createDeps() as any);

    const incomingInvoice = modules.find(
      (module) => module.docType === "incoming_invoice",
    );
    const paymentOrder = modules.find(
      (module) => module.docType === "payment_order",
    );
    const outgoingInvoice = modules.find(
      (module) => module.docType === "outgoing_invoice",
    );

    expect(incomingInvoice?.accountingSourceId).toBe(
      ACCOUNTING_SOURCE_ID.TREASURY_OBLIGATION_OPENED,
    );
    expect(paymentOrder?.accountingSourceId).toBe(
      ACCOUNTING_SOURCE_ID.TREASURY_EXECUTION_SUBMITTED,
    );
    expect(outgoingInvoice?.accountingSourceId).toBe(
      ACCOUNTING_SOURCE_ID.TREASURY_OBLIGATION_OPENED,
    );
    expect(paymentOrder?.postingRequired).toBe(true);
    expect(paymentOrder?.allowDirectPostFromDraft).toBe(false);
  });
});
