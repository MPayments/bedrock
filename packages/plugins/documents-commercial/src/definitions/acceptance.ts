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
    applicationDocumentId: "",
    invoiceDocumentId: "",
    settlementEvidenceFileAssetIds: [],
    memo: "",
  };
}

export const acceptanceDocumentDefinition = {
  docType: "acceptance",
  label: "Акт / подтверждение исполнения",
  family: "commercial",
  docNoPrefix: "ACT",
  schema: AcceptanceInputSchema,
  creatable: true,
  hasTypedForm: true,
  adminOnly: false,
  listed: true,
  formDefinition: {
    docType: "acceptance",
    label: "Акт / подтверждение исполнения",
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
            name: "applicationDocumentId",
            label: "Поручение",
            disabled: true,
            docTypes: ["application"],
          },
          {
            kind: "text",
            name: "invoiceDocumentId",
            label: "Счёт на оплату",
            hidden: true,
          },
          { kind: "textarea", name: "memo", label: "Комментарий", rows: 3 },
        ],
        layout: {
          rows: [
            { fields: ["occurredAt", "applicationDocumentId"] },
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
        applicationDocumentId: readString(payload.applicationDocumentId),
        invoiceDocumentId: readString(payload.invoiceDocumentId),
        settlementEvidenceFileAssetIds: Array.isArray(
          payload.settlementEvidenceFileAssetIds,
        )
          ? payload.settlementEvidenceFileAssetIds
          : [],
        memo: readString(payload.memo),
      };
    },
    toPayload(values) {
      return createAcceptancePayload(values);
    },
  },
} satisfies CommercialDocumentCatalogEntry;
