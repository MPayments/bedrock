import { describe, expect, it } from "vitest";

import {
  buildDocumentCreateHref,
  buildDocumentDetailsHref,
  buildDocumentsFamilyHref,
  buildDocumentTypeHref,
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
    expect(buildDocumentCreateHref("transfer_resolution")).toBe(
      "/documents/create/transfer_resolution",
    );
    expect(
      buildDocumentDetailsHref("period_close", "doc-123"),
    ).toBe("/documents/ifrs/period_close/doc-123");
  });

  it("returns null for non-documents-workspace types", () => {
    expect(buildDocumentTypeHref("legacy_doc_type")).toBeNull();
    expect(buildDocumentCreateHref("unknown_doc_type")).toBeNull();
    expect(buildDocumentDetailsHref("legacy_doc_type", "doc-123")).toBeNull();
  });
});
