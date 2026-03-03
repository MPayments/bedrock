import { CapitalFundingInputSchema } from "@bedrock/application/ifrs-documents/contracts";

import type { DocumentFormDefinition } from "../types";
import {
  CAPITAL_FUNDING_KIND_OPTIONS,
  isoToDateTimeLocal,
  normalizeMajorAmountInput,
  nowDateTimeLocal,
  optionalString,
  parseSchema,
  readString,
  toOccurredAtIso,
} from "../shared";

export function createCapitalFundingDefinition(): DocumentFormDefinition {
  return {
    docType: "capital_funding",
    label: "Капитальное финансирование",
    family: "ifrs",
    schema: CapitalFundingInputSchema,
    sections: [
      {
        id: "main",
        title: "Основные реквизиты",
        fields: [
          { kind: "datetime", name: "occurredAt", label: "Дата документа" },
          {
            kind: "enum",
            name: "kind",
            label: "Тип финансирования",
            options: CAPITAL_FUNDING_KIND_OPTIONS,
          },
          { kind: "text", name: "entryRef", label: "Ссылка на запись" },
          { kind: "counterparty", name: "counterpartyId", label: "Контрагент" },
          {
            kind: "account",
            name: "counterpartyAccountId",
            label: "Счет контрагента",
            counterpartyField: "counterpartyId",
          },
        ],
      },
      {
        id: "amount",
        title: "Сумма",
        fields: [
          { kind: "amount", name: "amount", label: "Сумма" },
          { kind: "currency", name: "currency", label: "Валюта" },
          { kind: "textarea", name: "memo", label: "Комментарий", rows: 3 },
        ],
      },
    ],
    defaultValues() {
      return {
        occurredAt: nowDateTimeLocal(),
        kind: "founder_equity",
        entryRef: "",
        counterpartyId: "",
        counterpartyAccountId: "",
        amount: "",
        currency: "",
        memo: "",
      };
    },
    fromPayload(payload) {
      return {
        occurredAt: isoToDateTimeLocal(payload.occurredAt),
        kind: readString(payload.kind) || "founder_equity",
        entryRef: readString(payload.entryRef),
        counterpartyId: readString(payload.counterpartyId),
        counterpartyAccountId: readString(payload.counterpartyAccountId),
        amount: normalizeMajorAmountInput(payload.amount, payload.currency),
        currency: readString(payload.currency),
        memo: readString(payload.memo),
      };
    },
    toPayload(values) {
      return parseSchema(CapitalFundingInputSchema, {
        occurredAt: toOccurredAtIso(values.occurredAt),
        kind: readString(values.kind).trim(),
        entryRef: readString(values.entryRef).trim(),
        counterpartyId: readString(values.counterpartyId).trim(),
        counterpartyAccountId: readString(values.counterpartyAccountId).trim(),
        amount: normalizeMajorAmountInput(values.amount, values.currency),
        currency: readString(values.currency).trim(),
        memo: optionalString(values.memo),
      });
    },
  };
}
