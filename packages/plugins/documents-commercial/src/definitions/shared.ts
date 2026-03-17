import {
  isoToDateTimeLocal,
  nowDateTimeLocal,
  optionalString,
  parseSchema,
  RUSSIAN_MAJOR_AMOUNT_MESSAGES,
  readString,
  toOccurredAtIso,
} from "@bedrock/plugin-documents-sdk/definitions/shared";
import { formatPercentFromBps } from "@bedrock/plugin-documents-sdk/financial-lines";
import { normalizeMajorAmountInput } from "@bedrock/shared/money";

import { FINANCIAL_LINE_BUCKET_OPTIONS } from "../financial-lines";
import type { FinancialLinePayload } from "../validation";
import {
  AcceptanceInputSchema,
  ExchangeInputSchema,
  InvoiceInputSchema,
  InvoiceModeSchema,
} from "../validation";

export const INVOICE_MODE_OPTIONS = [
  { value: "direct", label: "Без обмена" },
  { value: "exchange", label: "С обменом" },
] as const;

function normalizeCommercialMajorAmountInput(
  amountMajor: unknown,
  currencyCode: unknown,
) {
  return normalizeMajorAmountInput(
    amountMajor,
    currencyCode,
    RUSSIAN_MAJOR_AMOUNT_MESSAGES,
  );
}

export function getDefaultInvoiceValues() {
  return {
    mode: "direct",
    occurredAt: nowDateTimeLocal(),
    customerId: "",
    counterpartyId: "",
    organizationId: "",
    organizationRequisiteId: "",
    amount: "",
    currency: "",
    quoteRef: "",
    financialLines: [],
    memo: "",
  };
}

export function mapPayloadFinancialLines(
  financialLines: FinancialLinePayload[] | undefined,
) {
  return (financialLines ?? []).map((line) => ({
    calcMethod:
      line.calcMethod === "percent" && typeof line.percentBps === "number"
        ? "percent"
        : "fixed",
    bucket: line.bucket,
    currency: line.currency,
    amount:
      line.calcMethod === "percent" && typeof line.percentBps === "number"
        ? ""
        : typeof line.amount === "string"
          ? line.amount
          : normalizeCommercialMajorAmountInput(line.amountMinor, line.currency),
    percent:
      line.calcMethod === "percent" && typeof line.percentBps === "number"
        ? formatPercentFromBps(line.percentBps)
        : "",
    memo: readString(line.memo),
  }));
}

function mapFinancialLineInput(
  line: Record<string, unknown>,
) {
  const calcMethod =
    readString(line.calcMethod).trim() === "percent" ? "percent" : "fixed";

  return {
    calcMethod,
    bucket: readString(line.bucket).trim(),
    currency: readString(line.currency).trim(),
    amount:
      calcMethod === "fixed"
        ? normalizeCommercialMajorAmountInput(line.amount, line.currency)
        : undefined,
    percent:
      calcMethod === "percent"
        ? readString(line.percent).trim()
        : undefined,
    memo: optionalString(line.memo),
  };
}

export function createInvoicePayload(values: Record<string, unknown>) {
  return parseSchema(InvoiceInputSchema, {
    mode: readString(values.mode) === "exchange" ? "exchange" : "direct",
    occurredAt: toOccurredAtIso(values.occurredAt),
    customerId: readString(values.customerId).trim(),
    counterpartyId: readString(values.counterpartyId).trim(),
    organizationId: optionalString(values.organizationId),
    organizationRequisiteId: readString(values.organizationRequisiteId).trim(),
    amount: normalizeCommercialMajorAmountInput(values.amount, values.currency),
    currency: readString(values.currency).trim(),
    quoteRef: optionalString(values.quoteRef),
    financialLines: Array.isArray(values.financialLines)
      ? values.financialLines.map((line) =>
          mapFinancialLineInput(line as Record<string, unknown>),
        )
      : [],
    memo: optionalString(values.memo),
  });
}

export function createExchangePayload(values: Record<string, unknown>) {
  return parseSchema(ExchangeInputSchema, {
    occurredAt: toOccurredAtIso(values.occurredAt),
    invoiceDocumentId: readString(values.invoiceDocumentId).trim(),
    executionRef: optionalString(values.executionRef),
    memo: optionalString(values.memo),
  });
}

export function createAcceptancePayload(values: Record<string, unknown>) {
  return parseSchema(AcceptanceInputSchema, {
    occurredAt: toOccurredAtIso(values.occurredAt),
    invoiceDocumentId: readString(values.invoiceDocumentId).trim(),
    memo: optionalString(values.memo),
  });
}

export {
  FINANCIAL_LINE_BUCKET_OPTIONS,
  InvoiceInputSchema,
  InvoiceModeSchema,
  ExchangeInputSchema,
  AcceptanceInputSchema,
  isoToDateTimeLocal,
  nowDateTimeLocal,
  readString,
};
