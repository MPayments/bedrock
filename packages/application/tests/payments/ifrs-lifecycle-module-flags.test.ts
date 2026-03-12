import { describe, expect, it } from "vitest";

import { createIfrsDocumentModules } from "../../src/ifrs-documents";

const SIMPLE_IFRS_DOC_TYPES = [
  "period_close",
  "period_reopen",
] as const;

describe("ifrs lifecycle module flags", () => {
  it("uses explicit submit step for non-posting IFRS documents", () => {
    const modules = createIfrsDocumentModules({
      requisitesService: {
        async resolveBindings() {
          return [];
        },
      },
    });

    for (const docType of SIMPLE_IFRS_DOC_TYPES) {
      const module = modules.find((candidate) => candidate.docType === docType);
      expect(module).toBeDefined();
      expect(module?.postingRequired).toBe(false);
      expect(module?.allowDirectPostFromDraft).toBe(false);
    }
  });
});
