import {
  COMMERCIAL_DOCUMENT_DEFINITIONS,
} from "@bedrock/plugin-documents-commercial/contracts";
import {
  IFRS_DOCUMENT_DEFINITIONS,
  IFRS_DOCUMENT_TYPE_ORDER,
} from "@bedrock/plugin-documents-ifrs/contracts";
import { describe, expect, it } from "vitest";

import { getDocumentFormDefinitionForRole } from "@/features/documents/lib/document-form-registry";

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
          docType,
          role: "admin",
        }),
      ).not.toBeNull();
    }
  });

  it("keeps admin-only and non-typed behavior", () => {
    expect(
      getDocumentFormDefinitionForRole({
        docType: "fx_execute",
        role: "user",
      }),
    ).not.toBeNull();

    expect(
      getDocumentFormDefinitionForRole({
        docType: "fx_resolution",
        role: "admin",
      }),
    ).toBeNull();

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

  it("keeps fx_execute amount-based and no longer exposes quoteRef input", () => {
    const definition = getDocumentFormDefinitionForRole({
      docType: "fx_execute",
      role: "admin",
    });

    expect(definition).not.toBeNull();

    const fieldNames =
      definition?.sections.flatMap((section) =>
        section.fields.map((field) => field.name),
      ) ?? [];

    expect(fieldNames).toContain("amount");
    expect(fieldNames).not.toContain("quoteRef");
  });

  it("exposes generated-quote fields for exchange invoice mode", () => {
    const definition = getDocumentFormDefinitionForRole({
      docType: "invoice",
      role: "admin",
    });

    expect(definition).not.toBeNull();

    const fieldNames =
      definition?.sections.flatMap((section) =>
        section.fields.map((field) => field.name),
      ) ?? [];
    const previewField = definition?.sections
      .flatMap((section) => section.fields)
      .find((field) => field.name === "quotePreview");

    expect(fieldNames).toContain("amount");
    expect(fieldNames).toContain("targetCurrency");
    expect(fieldNames).not.toContain("quoteRef");
    expect(previewField).toMatchObject({
      kind: "fxQuotePreview",
      requestMode: "auto_cross",
      amountFieldName: "amount",
      fromCurrencyFieldName: "currency",
      toCurrencyFieldName: "targetCurrency",
    });
  });

  it("exposes an auto-cross quote preview field for fx_execute", () => {
    const definition = getDocumentFormDefinitionForRole({
      docType: "fx_execute",
      role: "admin",
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

  it("exposes percent-enabled financial-lines metadata for invoice and fx_execute", () => {
    const definitions = [
      ...COMMERCIAL_DOCUMENT_DEFINITIONS,
      ...IFRS_DOCUMENT_DEFINITIONS,
    ];

    for (const docType of ["invoice", "fx_execute"]) {
      const definition = definitions.find((item) => item.docType === docType)
        ?.formDefinition;
      const financialLinesField = definition?.sections
        .flatMap((section) => section.fields)
        .find((field) => field.name === "financialLines");

      expect(financialLinesField).toMatchObject({
        kind: "financialLines",
        supportedCalcMethods: ["fixed", "percent"],
        baseAmountFieldName: "amount",
        baseCurrencyFieldName: "currency",
      });
    }
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
