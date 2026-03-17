import { FINANCIAL_LINE_BUCKET_OPTIONS } from "@bedrock/documents/contracts";
import { formatPercentFromBps } from "@bedrock/plugin-documents-sdk/financial-lines";
import { normalizeMajorAmountInput } from "@bedrock/shared/money";

import {
  isoToDateTimeLocal,
  nowDateTimeLocal,
  optionalNumber,
  optionalString,
  parseSchema,
  RUSSIAN_MAJOR_AMOUNT_MESSAGES,
  readString,
  toOccurredAtIso,
  TWO_COLUMN_SM_COLUMNS,
} from "./shared";
import type { IfrsDocumentCatalogEntry } from "./types";
import { FxExecuteInputSchema } from "../validation";

function getDefaultFxExecuteValues() {
  return {
    occurredAt: nowDateTimeLocal(),
    sourceOrganizationId: "",
    sourceRequisiteId: "",
    destinationOrganizationId: "",
    destinationRequisiteId: "",
    amount: "",
    currency: "",
    executionRef: "",
    timeoutSeconds: "",
    financialLines: [],
    memo: "",
  };
}

export const fxExecuteDocumentDefinition = {
  docType: "fx_execute",
  label: "Казначейский FX",
  family: "ifrs",
  docNoPrefix: "FXE",
  schema: FxExecuteInputSchema,
  creatable: true,
  hasTypedForm: true,
  adminOnly: false,
  listed: true,
  formDefinition: {
    docType: "fx_execute",
    label: "Казначейский FX",
    family: "ifrs",
    schema: FxExecuteInputSchema,
    sections: [
      {
        id: "main",
        title: "Основные реквизиты",
        fields: [
          { kind: "datetime", name: "occurredAt", label: "Дата документа" },
          {
            kind: "counterparty",
            name: "sourceOrganizationId",
            label: "Организация источника",
            optionsSource: "organizations",
          },
          {
            kind: "account",
            name: "sourceRequisiteId",
            label: "Реквизит источника",
            counterpartyField: "sourceOrganizationId",
            optionsSource: "organizationRequisites",
          },
          {
            kind: "counterparty",
            name: "destinationOrganizationId",
            label: "Организация назначения",
            optionsSource: "organizations",
          },
          {
            kind: "account",
            name: "destinationRequisiteId",
            label: "Реквизит назначения",
            counterpartyField: "destinationOrganizationId",
            optionsSource: "organizationRequisites",
          },
          {
            kind: "amount",
            name: "amount",
            label: "Сумма списания",
          },
          {
            kind: "currency",
            name: "currency",
            label: "Валюта источника",
            hidden: true,
            deriveFrom: {
              kind: "accountCurrency",
              accountFieldNames: ["sourceRequisiteId"],
            },
          },
          {
            kind: "text",
            name: "executionRef",
            label: "Референс исполнения",
            placeholder: "provider/dealer ticket",
            description:
              "Опционально. Референс исполнения у провайдера или дилера.",
          },
          {
            kind: "number",
            name: "timeoutSeconds",
            label: "Таймаут (секунды)",
            min: 1,
            step: 1,
            description:
              "Опционально. Для pending-исполнения задайте TTL в секундах.",
          },
          { kind: "textarea", name: "memo", label: "Комментарий", rows: 3 },
        ],
        layout: {
          rows: [
            {
              columns: TWO_COLUMN_SM_COLUMNS,
              fields: ["sourceOrganizationId", "sourceRequisiteId"],
            },
            {
              columns: TWO_COLUMN_SM_COLUMNS,
              fields: ["destinationOrganizationId", "destinationRequisiteId"],
            },
            {
              columns: TWO_COLUMN_SM_COLUMNS,
              fields: ["amount", "executionRef"],
            },
            {
              columns: TWO_COLUMN_SM_COLUMNS,
              fields: ["occurredAt", "timeoutSeconds"],
            },
            { fields: ["memo"] },
          ],
        },
      },
      {
        id: "fees",
        title: "Финансовые строки",
        fields: [
          {
            kind: "financialLines",
            name: "financialLines",
            label: "Дополнительные финансовые строки",
            bucketOptions: [...FINANCIAL_LINE_BUCKET_OPTIONS],
            supportedCalcMethods: ["fixed", "percent"],
            baseAmountFieldName: "amount",
            baseCurrencyFieldName: "currency",
          },
        ],
        layout: {
          rows: [{ fields: ["financialLines"] }],
        },
      },
    ],
    defaultValues: getDefaultFxExecuteValues,
    fromPayload(payload) {
      const quoteSnapshot =
        typeof payload.quoteSnapshot === "object" && payload.quoteSnapshot !== null
          ? (payload.quoteSnapshot as Record<string, unknown>)
          : null;
      const payloadFinancialLines = Array.isArray(payload.financialLines)
        ? (payload.financialLines as Record<string, unknown>[])
        : [];

      return {
        ...getDefaultFxExecuteValues(),
        occurredAt: isoToDateTimeLocal(payload.occurredAt),
        sourceOrganizationId: readString(payload.sourceOrganizationId),
        sourceRequisiteId: readString(payload.sourceRequisiteId),
        destinationOrganizationId: readString(payload.destinationOrganizationId),
        destinationRequisiteId: readString(payload.destinationRequisiteId),
        amount: normalizeMajorAmountInput(
          payload.amount,
          quoteSnapshot?.fromCurrency,
          RUSSIAN_MAJOR_AMOUNT_MESSAGES,
        ),
        currency: readString(quoteSnapshot?.fromCurrency),
        executionRef: readString(payload.executionRef),
        timeoutSeconds:
          typeof payload.timeoutSeconds === "number"
            ? payload.timeoutSeconds
            : readString(payload.timeoutSeconds),
        financialLines: payloadFinancialLines
          .filter((line) => readString(line.source) === "manual")
          .map((line) => ({
            calcMethod:
              readString(line.calcMethod) === "percent" &&
              typeof line.percentBps === "number"
                ? "percent"
                : "fixed",
            bucket: readString(line.bucket),
            currency: readString(line.currency),
            amount:
              readString(line.calcMethod) === "percent" &&
              typeof line.percentBps === "number"
                ? ""
                : readString(line.amount),
            percent:
              readString(line.calcMethod) === "percent" &&
              typeof line.percentBps === "number"
                ? formatPercentFromBps(line.percentBps)
                : "",
            memo: readString(line.memo),
          })),
        memo: readString(payload.memo),
      };
    },
    toPayload(values) {
      return parseSchema(FxExecuteInputSchema, {
        occurredAt: toOccurredAtIso(values.occurredAt),
        sourceRequisiteId: readString(values.sourceRequisiteId).trim(),
        destinationRequisiteId: readString(values.destinationRequisiteId).trim(),
        amount: normalizeMajorAmountInput(
          values.amount,
          values.currency,
          RUSSIAN_MAJOR_AMOUNT_MESSAGES,
        ),
        currency: readString(values.currency).trim(),
        executionRef: optionalString(values.executionRef),
        timeoutSeconds: optionalNumber(values.timeoutSeconds),
        financialLines: Array.isArray(values.financialLines)
          ? values.financialLines.map((line) => {
              const row = line as Record<string, unknown>;
              const calcMethod =
                readString(row.calcMethod).trim() === "percent"
                  ? "percent"
                  : "fixed";

              return {
                calcMethod,
                bucket: readString(row.bucket).trim(),
                currency: readString(row.currency).trim(),
                amount:
                  calcMethod === "fixed"
                    ? readString(row.amount).trim()
                    : undefined,
                percent:
                  calcMethod === "percent"
                    ? readString(row.percent).trim()
                    : undefined,
                memo: optionalString(row.memo),
              };
            })
          : [],
        memo: optionalString(values.memo),
      });
    },
  },
} satisfies IfrsDocumentCatalogEntry;
