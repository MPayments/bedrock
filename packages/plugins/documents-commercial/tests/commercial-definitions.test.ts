import { describe, expect, it } from "vitest";

import {
  COMMERCIAL_DOCUMENT_DEFINITIONS,
  COMMERCIAL_DOCUMENT_METADATA,
  COMMERCIAL_DOCUMENT_TYPE_ORDER,
  getCommercialDocumentDefinition,
} from "../src";

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
    const mainSection = formDefinition!.sections.find(
      (section) => section.id === "main",
    );
    const financialLines = fields.find((field) => field.name === "financialLines");
    const exchangeSection = formDefinition!.sections.find(
      (section) => section.id === "exchange",
    );
    const exchangePreview = fields.find((field) => field.name === "quotePreview");
    const targetCurrency = fields.find((field) => field.name === "targetCurrency");
    const exchangeCurrencies = fields.filter(
      (field) => field.kind === "currency" && field.name === "currency",
    );

    expect(mainSection?.layout?.rows).toContainEqual({
      columns: { base: 1, sm: 2 },
      fields: ["customerId", "counterpartyId"],
    });
    expect(mainSection?.layout?.rows).toContainEqual({
      columns: { base: 1, sm: 2 },
      fields: ["organizationId", "organizationRequisiteId"],
    });
    expect(financialLines).toMatchObject({
      kind: "financialLines",
      supportedCalcMethods: ["fixed", "percent"],
      baseAmountFieldName: "amount",
      baseCurrencyFieldName: "currency",
      visibleWhen: { fieldName: "mode", equals: ["direct"] },
    });
    expect(exchangeCurrencies).toContainEqual(
      expect.objectContaining({
        kind: "currency",
        hidden: true,
        deriveFrom: {
          kind: "accountCurrency",
          accountFieldNames: ["organizationRequisiteId"],
        },
      }),
    );
    expect(targetCurrency).toMatchObject({
      kind: "currency",
      visibleWhen: { fieldName: "mode", equals: ["exchange"] },
    });
    expect(exchangePreview).toMatchObject({
      kind: "fxQuotePreview",
      requestMode: "auto_cross",
      amountFieldName: "amount",
      fromCurrencyFieldName: "currency",
      toCurrencyFieldName: "targetCurrency",
      visibleWhen: { fieldName: "mode", equals: ["exchange"] },
    });
    expect(exchangeSection?.layout?.rows).toEqual([
      { fields: ["amount", "targetCurrency"] },
      { fields: ["quotePreview"] },
    ]);
  });

  it("round-trips invoice percent rows through the typed definition", () => {
    const invoice = getCommercialDocumentDefinition("invoice");
    const formDefinition = invoice?.formDefinition;

    const values = formDefinition?.fromPayload({
      occurredAt: "2026-03-03T10:00:00.000Z",
      mode: "direct",
      customerId: "00000000-0000-4000-8000-000000000001",
      counterpartyId: "00000000-0000-4000-8000-000000000002",
      organizationId: "00000000-0000-4000-8000-000000000003",
      organizationRequisiteId: "00000000-0000-4000-8000-000000000004",
      amount: "100.00",
      amountMinor: "10000",
      currency: "USD",
      financialLines: [
        {
          id: "manual:1",
          bucket: "fee_revenue",
          currency: "USD",
          amount: "1.25",
          amountMinor: "125",
          source: "manual",
          settlementMode: "in_ledger",
          calcMethod: "percent",
          percentBps: 125,
        },
      ],
    });

    expect(values?.financialLines).toEqual([
      {
        calcMethod: "percent",
        bucket: "fee_revenue",
        currency: "USD",
        amount: "",
        percent: "1.25",
        memo: "",
      },
    ]);

    expect(formDefinition?.toPayload(values ?? {})).toMatchObject({
      mode: "direct",
      financialLines: [
        {
          calcMethod: "percent",
          bucket: "fee_revenue",
          currency: "USD",
          percent: "1.25",
        },
      ],
    });
  });

  it("restores generated exchange invoice inputs from stored quote snapshots", () => {
    const invoice = getCommercialDocumentDefinition("invoice");
    const formDefinition = invoice?.formDefinition;

    expect(
      formDefinition?.fromPayload({
        occurredAt: "2026-03-03T10:00:00.000Z",
        mode: "exchange",
        customerId: "00000000-0000-4000-8000-000000000001",
        counterpartyId: "00000000-0000-4000-8000-000000000002",
        organizationId: "00000000-0000-4000-8000-000000000003",
        organizationRequisiteId: "00000000-0000-4000-8000-000000000004",
        quoteSnapshot: {
          quoteRef: "550e8400-e29b-41d4-a716-446655440010",
          fromCurrency: "USD",
          toCurrency: "EUR",
          fromAmountMinor: "10050",
        },
      }),
    ).toMatchObject({
      mode: "exchange",
      amount: "100.5",
      currency: "USD",
      targetCurrency: "EUR",
    });
  });
});
