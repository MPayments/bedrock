import { describe, expect, it } from "vitest";

import { COMMERCIAL_DOCUMENT_DEFINITIONS } from "@bedrock/plugin-documents-commercial/contracts";
import {
  IFRS_DOCUMENT_DEFINITIONS,
  IFRS_DOCUMENT_TYPE_ORDER,
} from "@bedrock/plugin-documents-ifrs/contracts";
import { getDocumentFormDefinitionForRole } from "@bedrock/sdk-documents-form-ui/lib/document-form-registry";
import type { DocumentFormDefinitions } from "@bedrock/sdk-documents-form-ui/lib/document-form-registry";

const DOCUMENT_FORM_DEFINITIONS = [
  ...COMMERCIAL_DOCUMENT_DEFINITIONS,
  ...IFRS_DOCUMENT_DEFINITIONS,
].flatMap((definition) =>
  definition.formDefinition ? [definition.formDefinition] : [],
) satisfies DocumentFormDefinitions;

describe("document form registry", () => {
  it("provides definitions for all typed IFRS doc types", () => {
    for (const docType of IFRS_DOCUMENT_TYPE_ORDER) {
      const definition = IFRS_DOCUMENT_DEFINITIONS.find(
        (candidate) => candidate.docType === docType,
      );
      if (!definition?.hasTypedForm) {
        continue;
      }

      expect(
        getDocumentFormDefinitionForRole({
          definitions: DOCUMENT_FORM_DEFINITIONS,
          docType,
          isAdmin: true,
        }),
      ).not.toBeNull();
    }
  });

  it("keeps admin-only and non-typed behavior", () => {
    expect(
      getDocumentFormDefinitionForRole({
        definitions: DOCUMENT_FORM_DEFINITIONS,
        docType: "fx_execute",
        isAdmin: false,
      }),
    ).not.toBeNull();

    expect(
      getDocumentFormDefinitionForRole({
        definitions: DOCUMENT_FORM_DEFINITIONS,
        docType: "fx_resolution",
        isAdmin: true,
      }),
    ).toBeNull();

    expect(
      getDocumentFormDefinitionForRole({
        definitions: DOCUMENT_FORM_DEFINITIONS,
        docType: "period_reopen",
        isAdmin: true,
      }),
    ).not.toBeNull();

    expect(
      getDocumentFormDefinitionForRole({
        definitions: DOCUMENT_FORM_DEFINITIONS,
        docType: "period_reopen",
        isAdmin: false,
      }),
    ).toBeNull();

    expect(
      getDocumentFormDefinitionForRole({
        definitions: DOCUMENT_FORM_DEFINITIONS,
        docType: "period_close",
        isAdmin: true,
      }),
    ).toBeNull();
  });

  it("exposes an auto-cross quote preview field for fx_execute", () => {
    const definition = getDocumentFormDefinitionForRole({
      definitions: DOCUMENT_FORM_DEFINITIONS,
      docType: "fx_execute",
      isAdmin: true,
    });

    const previewField = definition?.sections
      .flatMap((section) => section.fields)
      .find((field) => field.name === "quotePreview");

    expect(previewField).toMatchObject({
      kind: "fxQuotePreview",
      requestMode: "auto_cross",
      amountFieldName: "amount",
      fromCurrencyFieldName: "currency",
      toCurrencyFieldName: "destinationCurrency",
    });
  });

  it("exposes percent-enabled financial-lines metadata for fx_execute", () => {
    const definitions = [
      ...COMMERCIAL_DOCUMENT_DEFINITIONS,
      ...IFRS_DOCUMENT_DEFINITIONS,
    ];

    const definition = definitions.find(
      (item) => item.docType === "fx_execute",
    )?.formDefinition;
    const financialLinesField = definition?.sections
      .flatMap((section) => section.fields)
      .find((field) => field.name === "financialLines");

    expect(financialLinesField).toMatchObject({
      kind: "financialLines",
      supportedCalcMethods: ["fixed", "percent"],
      baseAmountFieldName: "amount",
      baseCurrencyFieldName: "currency",
    });
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
