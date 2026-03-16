import { describe, expect, it } from "vitest";

import {
  createIfrsDocumentModules,
  IFRS_DOCUMENT_TYPE_ORDER,
} from "../src";

describe("ifrs module registry", () => {
  it("registers one module per IFRS doc type in canonical order", () => {
    const modules = createIfrsDocumentModules({
      requisitesService: {
        async resolveBindings() {
          return [];
        },
        async findById() {
          throw new Error("not implemented");
        },
      },
      transferLookup: {
        async resolveTransferDependencyDocument() {
          throw new Error("not implemented");
        },
        async listPendingTransfers() {
          return [];
        },
      },
      fxExecuteLookup: {
        async resolveFxExecuteDependencyDocument() {
          throw new Error("not implemented");
        },
        async listPendingTransfers() {
          return [];
        },
      },
      quoteSnapshot: {
        async loadQuoteSnapshot() {
          throw new Error("not implemented");
        },
      },
      quoteUsage: {
        async markQuoteUsedForFxExecute() {},
      },
    });

    expect(modules).toHaveLength(IFRS_DOCUMENT_TYPE_ORDER.length);
    expect(modules.map((module) => module.docType)).toEqual(IFRS_DOCUMENT_TYPE_ORDER);
  });
});
