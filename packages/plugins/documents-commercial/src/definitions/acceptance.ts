import {
  createAcceptancePayload,
  isoToDateTimeLocal,
  nowDateTimeLocal,
  readString,
} from "./shared";
import type { CommercialDocumentCatalogEntry } from "./types";
import { AcceptanceInputSchema } from "../validation";

function getDefaultAcceptanceValues() {
  return {
    occurredAt: nowDateTimeLocal(),
    invoiceDocumentId: "",
    memo: "",
  };
}

export const acceptanceDocumentDefinition = {
  docType: "acceptance",
  label: "Акт",
  family: "commercial",
  docNoPrefix: "ACT",
  schema: AcceptanceInputSchema,
  creatable: true,
  hasTypedForm: true,
  adminOnly: false,
  listed: true,
  formDefinition: {
    docType: "acceptance",
    label: "Акт",
    family: "commercial",
    schema: AcceptanceInputSchema,
    sections: [
      {
        id: "main",
        title: "Основные реквизиты",
        fields: [
          { kind: "datetime", name: "occurredAt", label: "Дата документа" },
          {
            kind: "document",
            name: "invoiceDocumentId",
            label: "Счёт на оплату",
            disabled: true,
            docTypes: ["invoice"],
          },
          { kind: "textarea", name: "memo", label: "Комментарий", rows: 3 },
        ],
        layout: {
          rows: [
            { fields: ["occurredAt", "invoiceDocumentId"] },
            { fields: ["memo"] },
          ],
        },
      },
    ],
    defaultValues: getDefaultAcceptanceValues,
    fromPayload(payload) {
      return {
        ...getDefaultAcceptanceValues(),
        occurredAt: isoToDateTimeLocal(payload.occurredAt),
        invoiceDocumentId: readString(payload.invoiceDocumentId),
        memo: readString(payload.memo),
      };
    },
    toPayload(values) {
      return createAcceptancePayload(values);
    },
  },
} satisfies CommercialDocumentCatalogEntry;
