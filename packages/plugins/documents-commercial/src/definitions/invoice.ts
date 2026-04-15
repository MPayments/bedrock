import {
  createInvoicePayload,
  getDefaultInvoiceValues,
  isoToDateTimeLocal,
} from "./shared";
import type { CommercialDocumentCatalogEntry } from "./types";
import { InvoiceInputSchema, InvoicePayloadSchema } from "../validation";

export const invoiceDocumentDefinition = {
  docType: "invoice",
  label: "Исходящий инвойс",
  family: "commercial",
  docNoPrefix: "INV",
  schema: InvoiceInputSchema,
  creatable: true,
  hasTypedForm: true,
  adminOnly: false,
  listed: true,
  formDefinition: {
    docType: "invoice",
    label: "Исходящий инвойс",
    family: "commercial",
    schema: InvoiceInputSchema,
    sections: [
      {
        id: "main",
        title: "Основные реквизиты",
        fields: [
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
            currencyFieldName: "currency",
            optionsSource: "organizationRequisites",
          },
          { kind: "textarea", name: "memo", label: "Комментарий", rows: 3 },
        ],
        layout: {
          rows: [
            { fields: ["occurredAt"] },
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
        id: "amounts",
        title: "Реквизиты инвойса",
        fields: [
          {
            kind: "amount",
            name: "amount",
            label: "Сумма",
          },
          {
            kind: "currency",
            name: "currency",
            label: "Валюта списания",
          },
        ],
        layout: {
          rows: [{ fields: ["amount", "currency"] }],
        },
      },
    ],
    defaultValues: getDefaultInvoiceValues,
    fromPayload(payload) {
      const normalized = InvoicePayloadSchema.parse(payload);

      return {
        ...getDefaultInvoiceValues(),
        occurredAt: isoToDateTimeLocal(normalized.occurredAt),
        customerId: normalized.customerId,
        counterpartyId: normalized.counterpartyId,
        organizationId: normalized.organizationId ?? "",
        organizationRequisiteId: normalized.organizationRequisiteId,
        amount: normalized.amount,
        currency: normalized.currency,
        memo: normalized.memo ?? "",
      };
    },
    toPayload(values) {
      return createInvoicePayload(values);
    },
  },
} satisfies CommercialDocumentCatalogEntry;
