import {
  IFRS_DOCUMENT_METADATA,
  IFRS_DOCUMENT_TYPE_ORDER,
} from "@bedrock/ifrs-documents/contracts";
import { describe, expect, it } from "vitest";

import {
  canCreateDocumentType,
  getDocumentTypeFamily,
  getDocumentTypeLabel,
  hasTypedDocumentForm,
  isAdminOnlyDocumentType,
  isKnownDocumentType,
} from "@/features/documents/lib/doc-types";

describe("document doc types", () => {
  it("keeps IFRS labels and families aligned with application metadata", () => {
    for (const docType of IFRS_DOCUMENT_TYPE_ORDER) {
      const metadata = IFRS_DOCUMENT_METADATA[docType];

      expect(isKnownDocumentType(docType)).toBe(true);
      expect(getDocumentTypeLabel(docType)).toBe(metadata.label);
      expect(getDocumentTypeFamily(docType)).toBe(metadata.family);
      expect(isAdminOnlyDocumentType(docType)).toBe(metadata.adminOnly);
    }
  });

  it("enforces typed-form and create permissions for admin-only IFRS docs", () => {
    expect(hasTypedDocumentForm("period_reopen", "admin")).toBe(true);
    expect(hasTypedDocumentForm("period_reopen", "user")).toBe(false);

    expect(canCreateDocumentType("period_reopen", "admin")).toBe(true);
    expect(canCreateDocumentType("period_reopen", "user")).toBe(false);

    expect(hasTypedDocumentForm("period_close", "admin")).toBe(false);
    expect(canCreateDocumentType("period_close", "admin")).toBe(false);
    expect(canCreateDocumentType("period_close", "user")).toBe(false);
  });
});
