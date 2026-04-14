import {
  isoToDateTimeLocal,
  nowDateTimeLocal,
  optionalString,
  parseSchema,
  RUSSIAN_MAJOR_AMOUNT_MESSAGES,
  readString,
  toOccurredAtIso,
} from "@bedrock/plugin-documents-sdk/definitions/shared";
import { normalizeMajorAmountInput } from "@bedrock/shared/money";

import {
  AcceptanceInputSchema,
  ExchangeInputSchema,
  InvoiceInputSchema,
} from "../validation";

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
    occurredAt: nowDateTimeLocal(),
    customerId: "",
    counterpartyId: "",
    organizationId: "",
    organizationRequisiteId: "",
    amount: "",
    currency: "",
    memo: "",
  };
}

export function createInvoicePayload(values: Record<string, unknown>) {
  return parseSchema(InvoiceInputSchema, {
    occurredAt: toOccurredAtIso(values.occurredAt),
    customerId: readString(values.customerId).trim(),
    counterpartyId: readString(values.counterpartyId).trim(),
    organizationId: optionalString(values.organizationId),
    organizationRequisiteId: readString(values.organizationRequisiteId).trim(),
    amount: normalizeCommercialMajorAmountInput(values.amount, values.currency),
    currency: readString(values.currency).trim(),
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
  InvoiceInputSchema,
  ExchangeInputSchema,
  AcceptanceInputSchema,
  isoToDateTimeLocal,
  nowDateTimeLocal,
  normalizeCommercialMajorAmountInput,
  readString,
};
