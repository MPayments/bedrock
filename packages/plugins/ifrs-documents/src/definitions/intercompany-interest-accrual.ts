import { normalizeMajorAmountInput } from "@bedrock/common/money";

import { IntercompanyInterestAccrualInputSchema } from "../validation";
import {
  createAmountSectionLayout,
  isoToDateTimeLocal,
  nowDateTimeLocal,
  optionalString,
  parseSchema,
  RUSSIAN_MAJOR_AMOUNT_MESSAGES,
  readString,
  TWO_COLUMN_SM_COLUMNS,
  toOccurredAtIso,
} from "./shared";
import type { IfrsDocumentCatalogEntry } from "./types";

export const intercompanyInterestAccrualDocumentDefinition = {
  docType: "intercompany_interest_accrual",
  label: "Начисление межкорпоративных процентов",
  family: "ifrs",
  docNoPrefix: "IIA",
  schema: IntercompanyInterestAccrualInputSchema,
  creatable: true,
  hasTypedForm: true,
  adminOnly: false,
  listed: false,
  formDefinition: {
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
        amount: normalizeMajorAmountInput(
          payload.amount,
          payload.currency,
          RUSSIAN_MAJOR_AMOUNT_MESSAGES,
        ),
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
        amount: normalizeMajorAmountInput(
          values.amount,
          values.currency,
          RUSSIAN_MAJOR_AMOUNT_MESSAGES,
        ),
        currency: readString(values.currency).trim(),
        accrualPeriodMonth: optionalString(values.accrualPeriodMonth),
        reference: optionalString(values.reference),
        memo: optionalString(values.memo),
      });
    },
  },
} satisfies IfrsDocumentCatalogEntry;
