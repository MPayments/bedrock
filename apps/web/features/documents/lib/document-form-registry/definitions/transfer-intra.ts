import { TransferIntraInputSchema } from "@bedrock/application/ifrs-documents/contracts";

import type { DocumentFormDefinition } from "../types";
import {
  getDefaultTransferValues,
  isoToDateTimeLocal,
  normalizeMajorAmountInput,
  optionalNumber,
  optionalString,
  parseSchema,
  readString,
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
            name: "sourceCounterpartyId",
            label: "Контрагент",
            description:
              "Счета источника и назначения должны принадлежать одному контрагенту.",
          },
          {
            kind: "account",
            name: "sourceCounterpartyAccountId",
            label: "Счет источник",
            counterpartyField: "sourceCounterpartyId",
          },
          {
            kind: "account",
            name: "destinationCounterpartyAccountId",
            label: "Счет назначение",
            counterpartyField: "sourceCounterpartyId",
          },
        ],
      },
      {
        id: "amount",
        title: "Сумма",
        fields: [
          { kind: "amount", name: "amount", label: "Сумма" },
          { kind: "currency", name: "currency", label: "Валюта" },
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
      return parseSchema(TransferIntraInputSchema, {
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
