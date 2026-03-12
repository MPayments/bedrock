import {
  FINANCIAL_LINE_BUCKET_OPTIONS,
} from "../financial-lines";
import type { FinancialLinePayload } from "../validation";
import {
  isoToDateTimeLocal,
  normalizeMajorAmountInput,
  nowDateTimeLocal,
  optionalString,
  parseSchema,
  readString,
  toOccurredAtIso,
} from "@bedrock/ifrs-documents/definitions/shared";
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
    bucket: line.bucket,
    currency: line.currency,
    amount:
      typeof line.amount === "string"
        ? line.amount
        : normalizeMajorAmountInput(line.amountMinor, line.currency),
    memo: readString(line.memo),
  }));
}

export function createInvoicePayload(values: Record<string, unknown>) {
  return parseSchema(InvoiceInputSchema, {
    mode: readString(values.mode) === "exchange" ? "exchange" : "direct",
    occurredAt: toOccurredAtIso(values.occurredAt),
    customerId: readString(values.customerId).trim(),
    counterpartyId: readString(values.counterpartyId).trim(),
    organizationId: optionalString(values.organizationId),
    organizationRequisiteId: readString(values.organizationRequisiteId).trim(),
    amount: normalizeMajorAmountInput(values.amount, values.currency),
    currency: readString(values.currency).trim(),
    quoteRef: optionalString(values.quoteRef),
    financialLines: Array.isArray(values.financialLines)
      ? values.financialLines.map((line) => ({
          bucket: readString((line as Record<string, unknown>).bucket).trim(),
          currency: readString((line as Record<string, unknown>).currency).trim(),
          amount: normalizeMajorAmountInput(
            (line as Record<string, unknown>).amount,
            (line as Record<string, unknown>).currency,
          ),
          memo: optionalString((line as Record<string, unknown>).memo),
        }))
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
  normalizeMajorAmountInput,
  readString,
};
