import { describe, expect, it } from "vitest";

import {
  COMMERCIAL_DOCUMENT_DEFINITIONS,
  COMMERCIAL_DOCUMENT_METADATA,
  COMMERCIAL_DOCUMENT_TYPE_ORDER,
  getCommercialDocumentDefinition,
} from "../../src/commercial-documents";

describe("commercial document definitions", () => {
  it("exposes one canonical definition per commercial document type", () => {
    const docTypes = COMMERCIAL_DOCUMENT_DEFINITIONS.map(
      (definition) => definition.docType,
    );
    expect(new Set(docTypes).size).toBe(COMMERCIAL_DOCUMENT_DEFINITIONS.length);

    for (const definition of COMMERCIAL_DOCUMENT_DEFINITIONS) {
      expect(getCommercialDocumentDefinition(definition.docType)).toBe(definition);
      expect(COMMERCIAL_DOCUMENT_METADATA[definition.docType]).toMatchObject({
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

  it("keeps listed document order aligned with the UI-visible commercial order", () => {
    expect(
      COMMERCIAL_DOCUMENT_DEFINITIONS.filter((definition) => definition.listed).map(
        (definition) => definition.docType,
      ),
    ).toEqual(COMMERCIAL_DOCUMENT_TYPE_ORDER);
  });

  it("keeps invoice typed form split by mode with a financial-lines editor", () => {
    const invoice = getCommercialDocumentDefinition("invoice");
    const formDefinition = invoice?.formDefinition;
    expect(formDefinition).not.toBeNull();

    const fields = formDefinition!.sections.flatMap((section) => section.fields);
    const financialLines = fields.find((field) => field.name === "financialLines");
    const quoteRef = fields.find((field) => field.name === "quoteRef");

    expect(financialLines).toMatchObject({
      kind: "financialLines",
      visibleWhen: { fieldName: "mode", equals: ["direct"] },
    });
    expect(quoteRef).toMatchObject({
      kind: "text",
      visibleWhen: { fieldName: "mode", equals: ["exchange"] },
    });
  });
});
