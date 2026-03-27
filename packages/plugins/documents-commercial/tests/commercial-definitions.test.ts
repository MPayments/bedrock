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

  it("keeps incoming_invoice typed form with external basis fields", () => {
    const incomingInvoice = getCommercialDocumentDefinition("incoming_invoice");
    const formDefinition = incomingInvoice?.formDefinition;
    const fields = formDefinition?.sections.flatMap((section) => section.fields) ?? [];
    const externalBasisSection = formDefinition?.sections.find(
      (section) => section.id === "external-basis",
    );

    expect(fields.find((field) => field.name === "contour")).toMatchObject({
      kind: "enum",
      name: "contour",
    });
    expect(fields.find((field) => field.name === "customerId")).toMatchObject({
      kind: "customer",
    });
    expect(fields.find((field) => field.name === "organizationRequisiteId")).toMatchObject({
      kind: "account",
      optionsSource: "organizationRequisites",
    });
    expect(fields.find((field) => field.name === "currency")).toMatchObject({
      kind: "currency",
      hidden: true,
      deriveFrom: {
        kind: "accountCurrency",
        accountFieldNames: ["organizationRequisiteId"],
      },
    });
    expect(externalBasisSection?.fields.map((field) => field.name)).toEqual([
      "externalBasisSourceSystem",
      "externalBasisEntityType",
      "externalBasisEntityId",
      "externalBasisDocumentNumber",
    ]);
  });

  it("keeps payment_order typed form with FX preview and derived funding currency", () => {
    const paymentOrder = getCommercialDocumentDefinition("payment_order");
    const formDefinition = paymentOrder?.formDefinition;
    const fields = formDefinition?.sections.flatMap((section) => section.fields) ?? [];

    expect(
      fields.find((field) => field.name === "sourcePaymentOrderDocumentId"),
    ).toMatchObject({
      kind: "text",
      name: "sourcePaymentOrderDocumentId",
    });
    expect(fields.find((field) => field.name === "quotePreview")).toMatchObject({
      kind: "fxQuotePreview",
      requestMode: "auto_cross",
      amountFieldName: "amount",
      fromCurrencyFieldName: "currency",
      toCurrencyFieldName: "allocatedCurrency",
    });
    expect(fields.find((field) => field.name === "currency")).toMatchObject({
      kind: "currency",
      hidden: true,
      deriveFrom: {
        kind: "accountCurrency",
        accountFieldNames: ["organizationRequisiteId"],
      },
    });
    expect(fields.find((field) => field.name === "executionStatus")).toMatchObject({
      kind: "enum",
      name: "executionStatus",
    });
  });

  it("keeps outgoing_invoice typed form with derived currency", () => {
    const outgoingInvoice = getCommercialDocumentDefinition("outgoing_invoice");
    const formDefinition = outgoingInvoice?.formDefinition;
    const fields = formDefinition?.sections.flatMap((section) => section.fields) ?? [];

    expect(fields.find((field) => field.name === "organizationRequisiteId")).toMatchObject({
      kind: "account",
      optionsSource: "organizationRequisites",
    });
    expect(fields.find((field) => field.name === "currency")).toMatchObject({
      kind: "currency",
      hidden: true,
      deriveFrom: {
        kind: "accountCurrency",
        accountFieldNames: ["organizationRequisiteId"],
      },
    });
  });

  it("round-trips incoming_invoice external basis through the typed definition", () => {
    const incomingInvoice = getCommercialDocumentDefinition("incoming_invoice");
    const formDefinition = incomingInvoice?.formDefinition;

    const values = formDefinition?.fromPayload({
      occurredAt: "2026-03-03T10:00:00.000Z",
      contour: "intl",
      customerId: "00000000-0000-4000-8000-000000000001",
      counterpartyId: "00000000-0000-4000-8000-000000000002",
      organizationId: "00000000-0000-4000-8000-000000000003",
      organizationRequisiteId: "00000000-0000-4000-8000-000000000004",
      amount: "100.00",
      amountMinor: "10000",
      currency: "USD",
      externalBasis: {
        sourceSystem: "crm",
        entityType: "deal",
        entityId: "deal-42",
        documentNumber: "CI-001",
      },
      memo: "memo",
    });

    expect(values).toMatchObject({
      contour: "intl",
      externalBasisSourceSystem: "crm",
      externalBasisEntityType: "deal",
      externalBasisEntityId: "deal-42",
      externalBasisDocumentNumber: "CI-001",
    });
    expect(formDefinition?.toPayload(values ?? {})).toMatchObject({
      contour: "intl",
      externalBasis: {
        sourceSystem: "crm",
        entityType: "deal",
        entityId: "deal-42",
        documentNumber: "CI-001",
      },
    });
  });

  it("round-trips payment_order resolution references through the typed definition", () => {
    const paymentOrder = getCommercialDocumentDefinition("payment_order");
    const formDefinition = paymentOrder?.formDefinition;

    const values = formDefinition?.fromPayload({
      occurredAt: "2026-03-03T10:00:00.000Z",
      contour: "intl",
      incomingInvoiceDocumentId: "00000000-0000-4000-8000-000000000001",
      sourcePaymentOrderDocumentId: "00000000-0000-4000-8000-000000000002",
      counterpartyId: "00000000-0000-4000-8000-000000000003",
      counterpartyRequisiteId: "00000000-0000-4000-8000-000000000004",
      organizationId: "00000000-0000-4000-8000-000000000005",
      organizationRequisiteId: "00000000-0000-4000-8000-000000000006",
      fundingAmount: "100.00",
      fundingCurrency: "USD",
      allocatedCurrency: "EUR",
      executionStatus: "settled",
    });

    expect(values).toMatchObject({
      sourcePaymentOrderDocumentId: "00000000-0000-4000-8000-000000000002",
      amount: "100.00",
      currency: "USD",
    });
    expect(formDefinition?.toPayload(values ?? {})).toMatchObject({
      sourcePaymentOrderDocumentId: "00000000-0000-4000-8000-000000000002",
      executionStatus: "settled",
    });
  });
});
