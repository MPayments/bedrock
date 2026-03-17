import {
  FINANCIAL_LINE_BUCKET_OPTIONS,
  INVOICE_MODE_OPTIONS,
  createInvoicePayload,
  getDefaultInvoiceValues,
  isoToDateTimeLocal,
  mapPayloadFinancialLines,
  readString,
} from "./shared";
import type { CommercialDocumentCatalogEntry } from "./types";
import { InvoiceInputSchema } from "../validation";

export const invoiceDocumentDefinition = {
  docType: "invoice",
  label: "Инвойс",
  family: "commercial",
  docNoPrefix: "INV",
  schema: InvoiceInputSchema,
  creatable: true,
  hasTypedForm: true,
  adminOnly: false,
  listed: true,
  formDefinition: {
    docType: "invoice",
    label: "Инвойс",
    family: "commercial",
    schema: InvoiceInputSchema,
    sections: [
      {
        id: "main",
        title: "Основные реквизиты",
        fields: [
          {
            kind: "enum",
            name: "mode",
            label: "Режим",
            options: [...INVOICE_MODE_OPTIONS],
          },
          { kind: "datetime", name: "occurredAt", label: "Дата документа" },
          { kind: "customer", name: "customerId", label: "Клиент" },
          { kind: "counterparty", name: "counterpartyId", label: "Контрагент" },
          {
            kind: "counterparty",
            name: "organizationId",
            label: "Организация",
            optionsSource: "organizations",
          },
          {
            kind: "account",
            name: "organizationRequisiteId",
            label: "Реквизит организации",
            counterpartyField: "organizationId",
            optionsSource: "organizationRequisites",
          },
          { kind: "textarea", name: "memo", label: "Комментарий", rows: 3 },
        ],
        layout: {
          rows: [
            { fields: ["mode", "occurredAt"] },
            {
              columns: {
                base: 1,
                sm: 2,
              },
              fields: ["customerId", "counterpartyId"],
            },
            {
              columns: {
                base: 1,
                sm: 2,
              },
              fields: ["organizationId", "organizationRequisiteId"],
            },
            { fields: ["memo"] },
          ],
        },
      },
      {
        id: "direct",
        title: "Прямой инвойс",
        fields: [
          {
            kind: "amount",
            name: "amount",
            label: "Сумма",
            visibleWhen: { fieldName: "mode", equals: ["direct"] },
          },
          {
            kind: "currency",
            name: "currency",
            label: "Валюта",
            hidden: true,
            deriveFrom: {
              kind: "accountCurrency",
              accountFieldNames: ["organizationRequisiteId"],
            },
            visibleWhen: { fieldName: "mode", equals: ["direct"] },
          },
          {
            kind: "financialLines",
            name: "financialLines",
            label: "Финансовые строки",
            bucketOptions: [...FINANCIAL_LINE_BUCKET_OPTIONS],
            supportedCalcMethods: ["fixed", "percent"],
            baseAmountFieldName: "amount",
            baseCurrencyFieldName: "currency",
            visibleWhen: { fieldName: "mode", equals: ["direct"] },
          },
        ],
        layout: {
          rows: [
            { fields: ["amount", "currency"] },
            { fields: ["financialLines"] },
          ],
        },
      },
      {
        id: "exchange",
        title: "FX-снимок",
        fields: [
          {
            kind: "text",
            name: "quoteRef",
            label: "Quote ref",
            visibleWhen: { fieldName: "mode", equals: ["exchange"] },
          },
        ],
        layout: {
          rows: [{ fields: ["quoteRef"] }],
        },
      },
    ],
    defaultValues: getDefaultInvoiceValues,
    fromPayload(payload) {
      const mode = readString(payload.mode) === "exchange" ? "exchange" : "direct";
      const quoteSnapshot =
        typeof payload.quoteSnapshot === "object" && payload.quoteSnapshot !== null
          ? (payload.quoteSnapshot as Record<string, unknown>)
          : null;

      return {
        ...getDefaultInvoiceValues(),
        mode,
        occurredAt: isoToDateTimeLocal(payload.occurredAt),
        customerId: readString(payload.customerId),
        counterpartyId: readString(payload.counterpartyId),
        organizationId: readString(payload.organizationId),
        organizationRequisiteId: readString(payload.organizationRequisiteId),
        amount: readString(payload.amount),
        currency: readString(payload.currency),
        quoteRef: readString(quoteSnapshot?.quoteRef),
        financialLines: mapPayloadFinancialLines(
          Array.isArray(payload.financialLines)
            ? (payload.financialLines as any)
            : undefined,
        ),
        memo: readString(payload.memo),
      };
    },
    toPayload(values) {
      return createInvoicePayload(values);
    },
  },
} satisfies CommercialDocumentCatalogEntry;
