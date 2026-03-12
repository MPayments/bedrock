import { describe, expect, it, vi } from "vitest";

import { ACCOUNTING_SOURCE_ID } from "@bedrock/accounting/posting-contracts";

import {
  COMMERCIAL_DOCUMENT_TYPE_ORDER,
  createCommercialDocumentModules,
} from "../src";

describe("commercial module registry", () => {
  it("registers one module per commercial doc type in canonical order", () => {
    const modules = createCommercialDocumentModules({
      currenciesService: {
        findByCode: vi.fn(),
        findById: vi.fn(),
      } as any,
      requisitesService: {
        resolveBindings: vi.fn(),
      } as any,
    });

    expect(modules).toHaveLength(COMMERCIAL_DOCUMENT_TYPE_ORDER.length);
    expect(modules.map((module) => module.docType)).toEqual(
      COMMERCIAL_DOCUMENT_TYPE_ORDER,
    );
  });

  it("exposes the expected posting model for invoice, exchange, and acceptance", () => {
    const modules = createCommercialDocumentModules({
      currenciesService: {
        findByCode: vi.fn(),
        findById: vi.fn(),
      } as any,
      requisitesService: {
        resolveBindings: vi.fn(),
      } as any,
    });

    const invoice = modules.find((module) => module.docType === "invoice");
    const exchange = modules.find((module) => module.docType === "exchange");
    const acceptance = modules.find((module) => module.docType === "acceptance");

    expect(invoice?.accountingSourceIds).toEqual([
      ACCOUNTING_SOURCE_ID.INVOICE_DIRECT,
      ACCOUNTING_SOURCE_ID.INVOICE_RESERVE,
    ]);
    expect(exchange?.accountingSourceId).toBe(ACCOUNTING_SOURCE_ID.FX_EXECUTE);
    expect(acceptance?.postingRequired).toBe(false);
    expect(acceptance?.allowDirectPostFromDraft).toBe(false);
  });
});
