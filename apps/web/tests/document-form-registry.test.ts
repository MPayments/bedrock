import {
  IFRS_DOCUMENT_DEFINITIONS,
  IFRS_DOCUMENT_TYPE_ORDER,
} from "@bedrock/ifrs-documents/contracts";
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

  it("keeps layout metadata valid for current typed definitions", () => {
    for (const definition of IFRS_DOCUMENT_DEFINITIONS) {
      if (!definition.formDefinition) {
        continue;
      }

      const formDefinition = definition.formDefinition;

      for (const section of formDefinition.sections) {
        expect(section.layout).toBeDefined();

        const sectionFieldNames = section.fields
          .filter((field) => !field.hidden)
          .map((field) => field.name);
        const layoutFieldNames =
          section.layout?.rows.flatMap((row) =>
            row.fields.map((field) =>
              typeof field === "string" ? field : field.name,
            ),
          ) ?? [];

        expect(new Set(layoutFieldNames).size).toBe(layoutFieldNames.length);
        expect(layoutFieldNames).toHaveLength(sectionFieldNames.length);

        for (const fieldName of layoutFieldNames) {
          expect(sectionFieldNames).toContain(fieldName);
        }
      }
    }
  });
});
