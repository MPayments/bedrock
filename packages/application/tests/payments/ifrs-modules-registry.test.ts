import { describe, expect, it } from "vitest";

import {
  createIfrsDocumentModules,
  IFRS_DOCUMENT_TYPE_ORDER,
} from "../../src/ifrs-documents";

describe("ifrs module registry", () => {
  it("registers one module per IFRS doc type in canonical order", () => {
    const modules = createIfrsDocumentModules({
      counterpartyAccountsService: {
        async resolveTransferBindings() {
          return [];
        },
      },
    });

    expect(modules).toHaveLength(IFRS_DOCUMENT_TYPE_ORDER.length);
    expect(modules.map((module) => module.docType)).toEqual(IFRS_DOCUMENT_TYPE_ORDER);
  });
});
