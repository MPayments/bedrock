import { IntercompanyInterestAccrualInputSchema } from "@bedrock/ifrs-documents/contracts";

import type { DocumentFormDefinition } from "../types";
import {
  createAmountSectionLayout,
  isoToDateTimeLocal,
  normalizeMajorAmountInput,
  nowDateTimeLocal,
  optionalString,
  parseSchema,
  readString,
  TWO_COLUMN_SM_COLUMNS,
  toOccurredAtIso,
} from "../shared";

export function createIntercompanyInterestAccrualDefinition(): DocumentFormDefinition {
  return {
    docType: "intercompany_interest_accrual",
    label: "Начисление межкорпоративных процентов",
    family: "ifrs",
    schema: IntercompanyInterestAccrualInputSchema,
    sections: [
      {
        id: "main",
        title: "Основные реквизиты",
        fields: [
          { kind: "datetime", name: "occurredAt", label: "Дата документа" },
          {
            kind: "counterparty",
            name: "debtorCounterpartyId",
            label: "Контрагент-должник",
          },
          {
            kind: "counterparty",
            name: "creditorCounterpartyId",
            label: "Контрагент-кредитор",
          },
          {
            kind: "month",
            name: "accrualPeriodMonth",
            label: "Месяц периода начисления",
          },
          { kind: "text", name: "reference", label: "Референс" },
        ],
        layout: {
          rows: [
            {
              columns: TWO_COLUMN_SM_COLUMNS,
              fields: ["debtorCounterpartyId", "creditorCounterpartyId"],
            },
            {
              fields: ["accrualPeriodMonth"],
            },
            {
              fields: ["reference"],
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
          { kind: "currency", name: "currency", label: "Валюта" },
          { kind: "textarea", name: "memo", label: "Комментарий", rows: 3 },
        ],
        layout: createAmountSectionLayout(),
      },
    ],
    defaultValues() {
      return {
        occurredAt: nowDateTimeLocal(),
        debtorCounterpartyId: "",
        creditorCounterpartyId: "",
        amount: "",
        currency: "",
        accrualPeriodMonth: "",
        reference: "",
        memo: "",
      };
    },
    fromPayload(payload) {
      return {
        occurredAt: isoToDateTimeLocal(payload.occurredAt),
        debtorCounterpartyId: readString(payload.debtorCounterpartyId),
        creditorCounterpartyId: readString(payload.creditorCounterpartyId),
        amount: normalizeMajorAmountInput(payload.amount, payload.currency),
        currency: readString(payload.currency),
        accrualPeriodMonth: readString(payload.accrualPeriodMonth),
        reference: readString(payload.reference),
        memo: readString(payload.memo),
      };
    },
    toPayload(values) {
      return parseSchema(IntercompanyInterestAccrualInputSchema, {
        occurredAt: toOccurredAtIso(values.occurredAt),
        debtorCounterpartyId: readString(values.debtorCounterpartyId).trim(),
        creditorCounterpartyId: readString(
          values.creditorCounterpartyId,
        ).trim(),
        amount: normalizeMajorAmountInput(values.amount, values.currency),
        currency: readString(values.currency).trim(),
        accrualPeriodMonth: optionalString(values.accrualPeriodMonth),
        reference: optionalString(values.reference),
        memo: optionalString(values.memo),
      });
    },
  };
}
