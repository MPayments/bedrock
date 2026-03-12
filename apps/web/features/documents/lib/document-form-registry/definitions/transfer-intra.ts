import { TransferIntraInputSchema } from "@multihansa/ifrs-documents/contracts";

import type { DocumentFormDefinition } from "../types";
import {
  getDefaultTransferValues,
  isoToDateTimeLocal,
  normalizeMajorAmountInput,
  optionalNumber,
  optionalString,
  parseSchema,
  readString,
  TWO_COLUMN_SM_COLUMNS,
  toOccurredAtIso,
} from "../shared";

export function createTransferIntraDefinition(): DocumentFormDefinition {
  return {
    docType: "transfer_intra",
    label: "Внутренний перевод",
    family: "transfers",
    schema: TransferIntraInputSchema,
    sections: [
      {
        id: "main",
        title: "Основные реквизиты",
        fields: [
          { kind: "datetime", name: "occurredAt", label: "Дата документа" },
          {
            kind: "counterparty",
            name: "organizationId",
            label: "Организация",
            optionsSource: "organizations",
            description:
              "Реквизиты источника и назначения должны принадлежать одной организации.",
          },
          {
            kind: "account",
            name: "sourceRequisiteId",
            label: "Реквизит источник",
            counterpartyField: "organizationId",
            optionsSource: "organizationRequisites",
          },
          {
            kind: "account",
            name: "destinationRequisiteId",
            label: "Реквизит назначение",
            counterpartyField: "organizationId",
            optionsSource: "organizationRequisites",
          },
        ],
        layout: {
          rows: [
            {
              fields: ["organizationId"],
            },
            {
              columns: TWO_COLUMN_SM_COLUMNS,
              fields: ["sourceRequisiteId", "destinationRequisiteId"],
            },
            {
              fields: ["occurredAt"],
            },
          ],
        },
      },
      {
        id: "amount",
        title: "Сумма",
        fields: [
          { kind: "amount", name: "amount", label: "Сумма" },
          {
            kind: "currency",
            name: "currency",
            label: "Валюта",
            hidden: true,
            deriveFrom: {
              kind: "accountCurrency",
              accountFieldNames: ["sourceRequisiteId", "destinationRequisiteId"],
            },
          },
          {
            kind: "number",
            name: "timeoutSeconds",
            label: "Таймаут (секунды)",
            min: 1,
            step: 1,
            description:
              "Опционально. Для pending-перевода задайте TTL в секундах.",
          },
          { kind: "textarea", name: "memo", label: "Комментарий", rows: 3 },
        ],
        layout: {
          rows: [
            {
              fields: ["amount"],
            },
            {
              fields: ["timeoutSeconds"],
            },
            {
              fields: ["memo"],
            },
          ],
        },
      },
    ],
    defaultValues: getDefaultTransferValues,
    fromPayload(payload) {
      return {
        ...getDefaultTransferValues(),
        occurredAt: isoToDateTimeLocal(payload.occurredAt),
        organizationId: readString(payload.organizationId),
        sourceRequisiteId: readString(payload.sourceRequisiteId),
        destinationRequisiteId: readString(payload.destinationRequisiteId),
        amount: normalizeMajorAmountInput(payload.amount, payload.currency),
        currency: readString(payload.currency),
        timeoutSeconds:
          typeof payload.timeoutSeconds === "number"
            ? payload.timeoutSeconds
            : readString(payload.timeoutSeconds),
        memo: readString(payload.memo),
      };
    },
    toPayload(values) {
      return parseSchema(TransferIntraInputSchema, {
        occurredAt: toOccurredAtIso(values.occurredAt),
        organizationId: readString(values.organizationId).trim(),
        sourceRequisiteId: readString(values.sourceRequisiteId).trim(),
        destinationRequisiteId: readString(values.destinationRequisiteId).trim(),
        amount: normalizeMajorAmountInput(values.amount, values.currency),
        currency: readString(values.currency).trim(),
        timeoutSeconds: optionalNumber(values.timeoutSeconds),
        memo: optionalString(values.memo),
      });
    },
  };
}
