import { describe, expect, it } from "vitest";

import {
  buildDealDocumentsTabHref,
  buildDocumentCreateHref,
  buildDocumentDetailsHref,
  buildDocumentsFamilyHref,
  buildDocumentTypeHref,
  normalizeInternalReturnToPath,
} from "@/features/documents/lib/routes";

describe("document routes", () => {
  it("builds family and typed document hrefs for documents workspace types", () => {
    expect(buildDocumentsFamilyHref("transfers")).toBe("/documents/transfers");
    expect(buildDocumentsFamilyHref("ifrs")).toBe("/documents/ifrs");

    expect(buildDocumentTypeHref("transfer_intra")).toBe(
      "/documents/transfers?docType=transfer_intra",
    );
    expect(buildDocumentTypeHref("capital_funding")).toBe(
      "/documents/ifrs?docType=capital_funding",
    );
    expect(buildDocumentTypeHref("fx_resolution")).toBe(
      "/documents/ifrs?docType=fx_resolution",
    );
    expect(buildDocumentCreateHref("fx_execute")).toBe(
      "/documents/create/fx_execute",
    );
    expect(buildDocumentCreateHref("transfer_resolution")).toBe(
      "/documents/create/transfer_resolution",
    );
    expect(
      buildDocumentCreateHref("invoice", {
        dealId: "deal-123",
        reconciliationExceptionId: "exception-1",
        returnTo: buildDealDocumentsTabHref("deal-123"),
      }),
    ).toBe(
      "/documents/create/invoice?dealId=deal-123&reconciliationExceptionId=exception-1&returnTo=%2Ftreasury%2Fdeals%2Fdeal-123",
    );
    expect(
      buildDocumentDetailsHref("period_close", "doc-123", {
        reconciliationExceptionId: "exception-2",
        returnTo: "/treasury/deals/deal-123",
      }),
    ).toBe(
      "/documents/ifrs/period_close/doc-123?reconciliationExceptionId=exception-2&returnTo=%2Ftreasury%2Fdeals%2Fdeal-123",
    );
  });

  it("returns null for non-documents-workspace types", () => {
    expect(buildDocumentTypeHref("unknown_doc_type")).toBeNull();
    expect(buildDocumentCreateHref("unknown_doc_type")).toBeNull();
    expect(buildDocumentDetailsHref("unknown_doc_type", "doc-123")).toBeNull();
  });

  it("accepts only internal absolute returnTo paths", () => {
    expect(
      normalizeInternalReturnToPath("/treasury/deals/deal-123"),
    ).toBe("/treasury/deals/deal-123");
    expect(normalizeInternalReturnToPath("https://example.com")).toBeNull();
    expect(normalizeInternalReturnToPath("//example.com")).toBeNull();
    expect(normalizeInternalReturnToPath("documents")).toBeNull();
  });
});
