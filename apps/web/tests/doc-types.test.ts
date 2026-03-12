import {
  IFRS_DOCUMENT_METADATA,
  IFRS_DOCUMENT_TYPE_ORDER,
} from "@bedrock/ifrs-documents/contracts";
import { describe, expect, it } from "vitest";

import {
  canCreateDocumentType,
  getDocumentTypeFamily,
  getDocumentsWorkspaceFamily,
  getDocumentsWorkspaceFamilyLabel,
  getDocumentsWorkspaceTypesForFamily,
  getDocumentTypeLabel,
  hasTypedDocumentForm,
  isDocumentsWorkspaceFamily,
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

  it("exposes the documents workspace families and role-scoped type lists", () => {
    expect(isDocumentsWorkspaceFamily("transfers")).toBe(true);
    expect(isDocumentsWorkspaceFamily("ifrs")).toBe(true);
    expect(isDocumentsWorkspaceFamily("legacy")).toBe(false);

    expect(getDocumentsWorkspaceFamily("transfer_intra")).toBe("transfers");
    expect(getDocumentsWorkspaceFamily("capital_funding")).toBe("ifrs");
    expect(getDocumentsWorkspaceFamily("legacy_doc_type")).toBeNull();

    expect(getDocumentsWorkspaceFamilyLabel("transfers")).toBe("Переводы");
    expect(getDocumentsWorkspaceFamilyLabel("ifrs")).toBe("Учетные документы");

    expect(
      getDocumentsWorkspaceTypesForFamily("transfers", "user").map(
        (option) => option.value,
      ),
    ).toEqual([
      "transfer_intra",
      "transfer_intercompany",
      "transfer_resolution",
    ]);
    expect(
      getDocumentsWorkspaceTypesForFamily("ifrs", "user").map(
        (option) => option.value,
      ),
    ).toEqual(["capital_funding"]);
    expect(
      getDocumentsWorkspaceTypesForFamily("ifrs", "admin").map(
        (option) => option.value,
      ),
    ).toEqual(["capital_funding", "period_close", "period_reopen"]);
  });
});
