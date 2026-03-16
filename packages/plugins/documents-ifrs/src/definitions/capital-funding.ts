import { normalizeMajorAmountInput } from "@bedrock/shared/money";

import { CapitalFundingInputSchema } from "../validation";
import {
  CAPITAL_FUNDING_KIND_OPTIONS,
  isoToDateTimeLocal,
  nowDateTimeLocal,
  optionalString,
  parseSchema,
  RUSSIAN_MAJOR_AMOUNT_MESSAGES,
  readString,
  toOccurredAtIso,
} from "./shared";
import type { IfrsDocumentCatalogEntry } from "./types";

export const capitalFundingDocumentDefinition = {
  docType: "capital_funding",
  label: "Капитальное финансирование",
  family: "ifrs",
  docNoPrefix: "CAP",
  schema: CapitalFundingInputSchema,
  creatable: true,
  hasTypedForm: true,
  adminOnly: false,
  listed: true,
  formDefinition: {
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
          { kind: "counterparty", name: "counterpartyId", label: "Контрагент" },
          {
            kind: "counterparty",
            name: "organizationId",
            label: "Организация",
            optionsSource: "organizations",
          },
          {
            kind: "account",
            name: "organizationRequisiteId",
            label: "Реквизит организации",
            counterpartyField: "organizationId",
            optionsSource: "organizationRequisites",
          },
          {
            kind: "account",
            name: "counterpartyRequisiteId",
            label: "Реквизит контрагента",
            counterpartyField: "counterpartyId",
            optionsSource: "counterpartyRequisites",
          },
        ],
        layout: {
          rows: [
            {
              fields: ["kind"],
            },
            {
              fields: ["counterpartyId", "organizationId"],
            },
            {
              columns: {
                base: 1,
                sm: 2,
              },
              fields: ["organizationRequisiteId", "counterpartyRequisiteId"],
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
              accountFieldNames: ["organizationRequisiteId"],
            },
          },
          { kind: "textarea", name: "memo", label: "Комментарий", rows: 3 },
        ],
        layout: {
          rows: [
            {
              fields: ["amount"],
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
        kind: "founder_equity",
        counterpartyId: "",
        organizationId: "",
        organizationRequisiteId: "",
        counterpartyRequisiteId: "",
        amount: "",
        currency: "",
        memo: "",
      };
    },
    fromPayload(payload) {
      return {
        occurredAt: isoToDateTimeLocal(payload.occurredAt),
        kind: readString(payload.kind) || "founder_equity",
        counterpartyId: readString(payload.counterpartyId),
        organizationId: readString(payload.organizationId),
        organizationRequisiteId: readString(payload.organizationRequisiteId),
        counterpartyRequisiteId: readString(payload.counterpartyRequisiteId),
        amount: normalizeMajorAmountInput(
          payload.amount,
          payload.currency,
          RUSSIAN_MAJOR_AMOUNT_MESSAGES,
        ),
        currency: readString(payload.currency),
        memo: readString(payload.memo),
      };
    },
    toPayload(values) {
      return parseSchema(CapitalFundingInputSchema, {
        occurredAt: toOccurredAtIso(values.occurredAt),
        kind: readString(values.kind).trim(),
        counterpartyId: readString(values.counterpartyId).trim(),
        organizationId: readString(values.organizationId).trim(),
        organizationRequisiteId: readString(
          values.organizationRequisiteId,
        ).trim(),
        counterpartyRequisiteId: readString(
          values.counterpartyRequisiteId,
        ).trim(),
        amount: normalizeMajorAmountInput(
          values.amount,
          values.currency,
          RUSSIAN_MAJOR_AMOUNT_MESSAGES,
        ),
        currency: readString(values.currency).trim(),
        memo: optionalString(values.memo),
      });
    },
  },
} satisfies IfrsDocumentCatalogEntry;
