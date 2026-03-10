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
      "/documents/transfers/transfer_intra",
    );
    expect(buildDocumentTypeHref("capital_funding")).toBe(
      "/documents/ifrs/capital_funding",
    );
    expect(buildDocumentCreateHref("transfer_resolution")).toBe(
      "/documents/transfers/transfer_resolution/create",
    );
    expect(
      buildDocumentDetailsHref("period_close", "doc-123"),
    ).toBe("/documents/ifrs/period_close/doc-123");
  });

  it("returns null for non-documents-workspace types", () => {
    expect(buildDocumentTypeHref("payment_intent")).toBeNull();
    expect(buildDocumentCreateHref("payment_resolution")).toBeNull();
    expect(buildDocumentDetailsHref("payment_intent", "doc-123")).toBeNull();
  });
});
