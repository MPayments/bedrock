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
  ApplicationInputSchema,
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
    invoicePurpose: "combined",
    billingSetRef: "",
    quoteComponentIds: [],
    amount: "",
    currency: "",
    memo: "",
  };
}

export function getDefaultApplicationValues() {
  return {
    occurredAt: nowDateTimeLocal(),
    dealId: "",
    quoteId: "",
    calculationId: "",
    customerId: "",
    counterpartyId: "",
    organizationId: "",
    organizationRequisiteId: "",
    memo: "",
  };
}

export function createApplicationPayload(values: Record<string, unknown>) {
  return parseSchema(ApplicationInputSchema, {
    occurredAt: toOccurredAtIso(values.occurredAt),
    dealId: readString(values.dealId).trim(),
    quoteId: readString(values.quoteId).trim(),
    calculationId: readString(values.calculationId).trim(),
    customerId: readString(values.customerId).trim(),
    counterpartyId: readString(values.counterpartyId).trim(),
    organizationId: readString(values.organizationId).trim(),
    organizationRequisiteId: readString(values.organizationRequisiteId).trim(),
    memo: optionalString(values.memo),
  });
}

export function createInvoicePayload(values: Record<string, unknown>) {
  const quoteComponentIds = Array.isArray(values.quoteComponentIds)
    ? values.quoteComponentIds.filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      )
    : undefined;

  return parseSchema(InvoiceInputSchema, {
    occurredAt: toOccurredAtIso(values.occurredAt),
    customerId: readString(values.customerId).trim(),
    counterpartyId: readString(values.counterpartyId).trim(),
    organizationId: optionalString(values.organizationId),
    organizationRequisiteId: readString(values.organizationRequisiteId).trim(),
    invoicePurpose: readString(values.invoicePurpose).trim() || "combined",
    billingSetRef: optionalString(values.billingSetRef),
    quoteComponentIds,
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
  const settlementEvidenceFileAssetIds = Array.isArray(
    values.settlementEvidenceFileAssetIds,
  )
    ? values.settlementEvidenceFileAssetIds.filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      )
    : undefined;

  return parseSchema(AcceptanceInputSchema, {
    occurredAt: toOccurredAtIso(values.occurredAt),
    applicationDocumentId: readString(values.applicationDocumentId).trim(),
    invoiceDocumentId: optionalString(values.invoiceDocumentId),
    settlementEvidenceFileAssetIds,
    memo: optionalString(values.memo),
  });
}

export {
  isoToDateTimeLocal,
  nowDateTimeLocal,
  readString,
};
