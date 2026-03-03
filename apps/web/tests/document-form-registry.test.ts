import { IFRS_DOCUMENT_TYPE_ORDER } from "@bedrock/application/ifrs-documents/contracts";
import { describe, expect, it } from "vitest";

import { getDocumentFormDefinitionForRole } from "@/features/documents/lib/document-form-registry";

describe("document form registry", () => {
  it("provides definitions for all typed IFRS doc types", () => {
    for (const docType of IFRS_DOCUMENT_TYPE_ORDER) {
      if (docType === "period_close") {
        continue;
      }

      expect(
        getDocumentFormDefinitionForRole({
          docType,
          role: "admin",
        }),
      ).not.toBeNull();
    }
  });

  it("keeps admin-only and non-typed behavior", () => {
    expect(
      getDocumentFormDefinitionForRole({
        docType: "period_reopen",
        role: "admin",
      }),
    ).not.toBeNull();

    expect(
      getDocumentFormDefinitionForRole({
        docType: "period_reopen",
        role: "user",
      }),
    ).toBeNull();

    expect(
      getDocumentFormDefinitionForRole({
        docType: "period_close",
        role: "admin",
      }),
    ).toBeNull();
  });
});
