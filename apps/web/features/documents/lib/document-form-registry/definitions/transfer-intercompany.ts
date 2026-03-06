import { TransferIntercompanyInputSchema } from "@bedrock/application/ifrs-documents/contracts";

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

export function createTransferIntercompanyDefinition(): DocumentFormDefinition {
  return {
    docType: "transfer_intercompany",
    label: "Межкорпоративный перевод",
    family: "transfers",
    schema: TransferIntercompanyInputSchema,
    sections: [
      {
        id: "main",
        title: "Основные реквизиты",
        fields: [
          { kind: "datetime", name: "occurredAt", label: "Дата документа" },
          {
            kind: "counterparty",
            name: "sourceCounterpartyId",
            label: "Контрагент источник",
          },
          {
            kind: "account",
            name: "sourceCounterpartyAccountId",
            label: "Счет источник",
            counterpartyField: "sourceCounterpartyId",
          },
          {
            kind: "counterparty",
            name: "destinationCounterpartyId",
            label: "Контрагент назначение",
          },
          {
            kind: "account",
            name: "destinationCounterpartyAccountId",
            label: "Счет назначение",
            counterpartyField: "destinationCounterpartyId",
          },
        ],
        layout: {
          rows: [
            {
              columns: TWO_COLUMN_SM_COLUMNS,
              fields: ["sourceCounterpartyId", "destinationCounterpartyId"],
            },
            {
              columns: TWO_COLUMN_SM_COLUMNS,
              fields: [
                "sourceCounterpartyAccountId",
                "destinationCounterpartyAccountId",
              ],
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
              accountFieldNames: [
                "sourceCounterpartyAccountId",
                "destinationCounterpartyAccountId",
              ],
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
        sourceCounterpartyId: readString(payload.sourceCounterpartyId),
        sourceCounterpartyAccountId: readString(
          payload.sourceCounterpartyAccountId,
        ),
        destinationCounterpartyId: readString(payload.destinationCounterpartyId),
        destinationCounterpartyAccountId: readString(
          payload.destinationCounterpartyAccountId,
        ),
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
      return parseSchema(TransferIntercompanyInputSchema, {
        occurredAt: toOccurredAtIso(values.occurredAt),
        sourceCounterpartyAccountId: readString(
          values.sourceCounterpartyAccountId,
        ).trim(),
        destinationCounterpartyAccountId: readString(
          values.destinationCounterpartyAccountId,
        ).trim(),
        amount: normalizeMajorAmountInput(values.amount, values.currency),
        currency: readString(values.currency).trim(),
        timeoutSeconds: optionalNumber(values.timeoutSeconds),
        memo: optionalString(values.memo),
      });
    },
  };
}
