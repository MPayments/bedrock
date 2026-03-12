import { describe, expect, it } from "vitest";

import {
  getIfrsDocumentDefinition,
  IFRS_DOCUMENT_DEFINITIONS,
  IFRS_DOCUMENT_METADATA,
  IFRS_DOCUMENT_TYPE_ORDER,
} from "../../src/ifrs-documents";

describe("ifrs document definitions", () => {
  it("exposes one canonical definition per IFRS document type", () => {
    const docTypes = IFRS_DOCUMENT_DEFINITIONS.map((definition) => definition.docType);
    expect(new Set(docTypes).size).toBe(IFRS_DOCUMENT_DEFINITIONS.length);

    for (const definition of IFRS_DOCUMENT_DEFINITIONS) {
      expect(getIfrsDocumentDefinition(definition.docType)).toBe(definition);
      expect(IFRS_DOCUMENT_METADATA[definition.docType]).toMatchObject({
        docType: definition.docType,
        label: definition.label,
        family: definition.family,
        docNoPrefix: definition.docNoPrefix,
        creatable: definition.creatable,
        hasTypedForm: definition.hasTypedForm,
        adminOnly: definition.adminOnly,
      });
    }
  });

  it("keeps listed document order aligned with the UI-visible IFRS order", () => {
    expect(
      IFRS_DOCUMENT_DEFINITIONS.filter((definition) => definition.listed).map(
        (definition) => definition.docType,
      ),
    ).toEqual(IFRS_DOCUMENT_TYPE_ORDER);
  });

  it("keeps typed-form and admin-only semantics for period close and reopen", () => {
    expect(getIfrsDocumentDefinition("period_close")?.formDefinition).toBeNull();
    expect(getIfrsDocumentDefinition("period_close")?.hasTypedForm).toBe(false);
    expect(getIfrsDocumentDefinition("period_close")?.adminOnly).toBe(true);

    expect(getIfrsDocumentDefinition("period_reopen")?.formDefinition).not.toBeNull();
    expect(getIfrsDocumentDefinition("period_reopen")?.adminOnly).toBe(true);
  });
});
