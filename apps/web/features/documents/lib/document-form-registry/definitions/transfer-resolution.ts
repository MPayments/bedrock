import { TransferResolutionInputSchema } from "@bedrock/ifrs-documents/contracts";

import type { DocumentFormDefinition } from "../types";
import {
  TRANSFER_RESOLUTION_TYPE_OPTIONS,
  isoToDateTimeLocal,
  nowDateTimeLocal,
  optionalNumber,
  optionalString,
  parseSchema,
  readString,
  toOccurredAtIso,
} from "../shared";

export function createTransferResolutionDefinition(): DocumentFormDefinition {
  return {
    docType: "transfer_resolution",
    label: "Разрешение перевода",
    family: "transfers",
    schema: TransferResolutionInputSchema,
    sections: [
      {
        id: "main",
        title: "Основные реквизиты",
        fields: [
          { kind: "datetime", name: "occurredAt", label: "Дата документа" },
          {
            kind: "text",
            name: "transferDocumentId",
            label: "Идентификатор документа перевода",
            placeholder: "UUID документа перевода",
          },
          {
            kind: "enum",
            name: "resolutionType",
            label: "Тип разрешения",
            options: TRANSFER_RESOLUTION_TYPE_OPTIONS,
          },
          {
            kind: "text",
            name: "eventIdempotencyKey",
            label: "Ключ идемпотентности события",
            placeholder: "evt:...",
          },
          {
            kind: "number",
            name: "pendingIndex",
            label: "Индекс ожидающего перевода",
            min: 0,
            step: 1,
          },
          { kind: "textarea", name: "memo", label: "Комментарий", rows: 3 },
        ],
        layout: {
          rows: [
            {
              fields: ["transferDocumentId"],
            },
            {
              fields: ["resolutionType"],
            },
            {
              fields: ["eventIdempotencyKey"],
            },
            {
              fields: ["pendingIndex"],
            },
            {
              fields: ["occurredAt"],
            },
            {
              fields: ["memo"],
            },
          ],
        },
      },
    ],
    defaultValues() {
      return {
        occurredAt: nowDateTimeLocal(),
        transferDocumentId: "",
        resolutionType: "settle",
        eventIdempotencyKey: "",
        pendingIndex: 0,
        memo: "",
      };
    },
    fromPayload(payload) {
      return {
        occurredAt: isoToDateTimeLocal(payload.occurredAt),
        transferDocumentId: readString(payload.transferDocumentId),
        resolutionType: readString(payload.resolutionType) || "settle",
        eventIdempotencyKey: readString(payload.eventIdempotencyKey),
        pendingIndex:
          typeof payload.pendingIndex === "number"
            ? payload.pendingIndex
            : (optionalNumber(payload.pendingIndex) ?? 0),
        memo: readString(payload.memo),
      };
    },
    toPayload(values) {
      return parseSchema(TransferResolutionInputSchema, {
        occurredAt: toOccurredAtIso(values.occurredAt),
        transferDocumentId: readString(values.transferDocumentId).trim(),
        resolutionType: readString(values.resolutionType).trim(),
        eventIdempotencyKey: readString(values.eventIdempotencyKey).trim(),
        pendingIndex: optionalNumber(values.pendingIndex) ?? 0,
        memo: optionalString(values.memo),
      });
    },
  };
}
