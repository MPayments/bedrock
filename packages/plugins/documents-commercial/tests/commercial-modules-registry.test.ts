import { describe, expect, it, vi } from "vitest";

import { ACCOUNTING_SOURCE_ID } from "@bedrock/accounting/posting-contracts";

import {
  COMMERCIAL_DOCUMENT_TYPE_ORDER,
  createCommercialDocumentModules,
} from "../src";

describe("commercial module registry", () => {
  const deps = {
    documentBusinessLinks: {
      findActiveDocumentIdByDealIdAndDocType: vi.fn(),
      findDealIdByDocumentId: vi.fn(),
    },
    documentRelations: {
      loadApplication: vi.fn(),
      loadInvoice: vi.fn(),
      getApplicationAcceptanceChild: vi.fn(),
      getInvoiceExchangeChild: vi.fn(),
      getInvoiceAcceptanceChild: vi.fn(),
      getExchangeAcceptance: vi.fn(),
    },
    quoteSnapshot: {
      loadQuoteSnapshot: vi.fn(),
    },
    quoteUsage: {
      markQuoteUsedForInvoice: vi.fn(),
    },
    requisiteBindings: {
      resolveBinding: vi.fn(),
    },
  };

  it("registers one module per commercial doc type in canonical order", () => {
    const modules = createCommercialDocumentModules(deps as any);

    expect(modules).toHaveLength(COMMERCIAL_DOCUMENT_TYPE_ORDER.length);
    expect(modules.map((module) => module.docType)).toEqual(
      COMMERCIAL_DOCUMENT_TYPE_ORDER,
    );
  });

  it("exposes the expected posting model for commercial documents", () => {
    const modules = createCommercialDocumentModules(deps as any);

    const application = modules.find(
      (module) => module.docType === "application",
    );
    const invoice = modules.find((module) => module.docType === "invoice");
    const exchange = modules.find((module) => module.docType === "exchange");
    const acceptance = modules.find((module) => module.docType === "acceptance");

    expect(application?.postingRequired).toBe(false);
    expect(application?.allowDirectPostFromDraft).toBe(false);
    expect(invoice?.accountingSourceIds).toEqual([
      ACCOUNTING_SOURCE_ID.INVOICE_DIRECT,
      ACCOUNTING_SOURCE_ID.INVOICE_INVENTORY_FINALIZE,
      ACCOUNTING_SOURCE_ID.INVOICE_RESERVE,
    ]);
    expect(exchange?.accountingSourceId).toBe(ACCOUNTING_SOURCE_ID.FX_EXECUTE);
    expect(acceptance?.postingRequired).toBe(false);
    expect(acceptance?.allowDirectPostFromDraft).toBe(false);
  });
});
