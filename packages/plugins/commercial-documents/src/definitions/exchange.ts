import {
  createExchangePayload,
  isoToDateTimeLocal,
  nowDateTimeLocal,
  readString,
} from "./shared";
import type { CommercialDocumentCatalogEntry } from "./types";
import { ExchangeInputSchema } from "../validation";

function getDefaultExchangeValues() {
  return {
    occurredAt: nowDateTimeLocal(),
    invoiceDocumentId: "",
    executionRef: "",
    memo: "",
  };
}

export const exchangeDocumentDefinition = {
  docType: "exchange",
  label: "Обмен",
  family: "commercial",
  docNoPrefix: "EXC",
  schema: ExchangeInputSchema,
  creatable: true,
  hasTypedForm: true,
  adminOnly: false,
  listed: true,
  formDefinition: {
    docType: "exchange",
    label: "Обмен",
    family: "commercial",
    schema: ExchangeInputSchema,
    sections: [
      {
        id: "main",
        title: "Основные реквизиты",
        fields: [
          { kind: "datetime", name: "occurredAt", label: "Дата документа" },
          {
            kind: "text",
            name: "invoiceDocumentId",
            label: "Инвойс",
            placeholder: "UUID инвойса",
          },
          {
            kind: "text",
            name: "executionRef",
            label: "Внешняя ссылка",
          },
          { kind: "textarea", name: "memo", label: "Комментарий", rows: 3 },
        ],
        layout: {
          rows: [
            { fields: ["occurredAt", "invoiceDocumentId"] },
            { fields: ["executionRef"] },
            { fields: ["memo"] },
          ],
        },
      },
    ],
    defaultValues: getDefaultExchangeValues,
    fromPayload(payload) {
      return {
        ...getDefaultExchangeValues(),
        occurredAt: isoToDateTimeLocal(payload.occurredAt),
        invoiceDocumentId: readString(payload.invoiceDocumentId),
        executionRef: readString(payload.executionRef),
        memo: readString(payload.memo),
      };
    },
    toPayload(values) {
      return createExchangePayload(values);
    },
  },
} satisfies CommercialDocumentCatalogEntry;
