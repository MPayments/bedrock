import {
  isoToDateTimeLocal,
  nowDateTimeLocal,
  optionalString,
  parseSchema,
  readString,
  RUSSIAN_MAJOR_AMOUNT_MESSAGES,
  toOccurredAtIso,
} from "@bedrock/plugin-documents-sdk/definitions/shared";
import { normalizeMajorAmountInput } from "@bedrock/shared/money";

import {
  CommercialContourSchema,
  IncomingInvoiceInputSchema,
  OutgoingInvoiceInputSchema,
  PaymentOrderExecutionStatusSchema,
  PaymentOrderInputSchema,
  type CommercialContour,
} from "../validation";

export const COMMERCIAL_CONTOUR_OPTIONS = [
  { value: "rf", label: "РФ" },
  { value: "intl", label: "Вне РФ" },
] as const;

export const PAYMENT_ORDER_EXECUTION_STATUS_OPTIONS = [
  { value: "prepared", label: "Подготовлено" },
  { value: "sent", label: "Отправлено" },
  { value: "settled", label: "Исполнено" },
  { value: "void", label: "Отменено" },
  { value: "failed", label: "Ошибка" },
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

export function resolveContourLabel(input: {
  docType: "incoming_invoice" | "payment_order" | "outgoing_invoice";
  contour: CommercialContour;
}) {
  if (input.docType === "payment_order") {
    return input.contour === "rf" ? "Платежное поручение" : "Payment Order";
  }

  if (input.docType === "incoming_invoice") {
    return input.contour === "rf" ? "Счет на оплату" : "Invoice";
  }

  return input.contour === "rf" ? "Счет" : "Invoice";
}

export function getDefaultIncomingInvoiceValues() {
  return {
    contour: "rf",
    occurredAt: nowDateTimeLocal(),
    customerId: "",
    counterpartyId: "",
    organizationId: "",
    organizationRequisiteId: "",
    amount: "",
    currency: "",
    externalBasisSourceSystem: "",
    externalBasisEntityType: "",
    externalBasisEntityId: "",
    externalBasisDocumentNumber: "",
    memo: "",
  };
}

export function getDefaultOutgoingInvoiceValues() {
  return {
    contour: "rf",
    occurredAt: nowDateTimeLocal(),
    counterpartyId: "",
    counterpartyRequisiteId: "",
    organizationId: "",
    organizationRequisiteId: "",
    amount: "",
    currency: "",
    memo: "",
  };
}

export function getDefaultPaymentOrderValues() {
  return {
    contour: "rf",
    occurredAt: nowDateTimeLocal(),
    incomingInvoiceDocumentId: "",
    sourcePaymentOrderDocumentId: "",
    counterpartyId: "",
    counterpartyRequisiteId: "",
    organizationId: "",
    organizationRequisiteId: "",
    amount: "",
    currency: "",
    allocatedCurrency: "",
    executionStatus: "sent",
    executionRef: "",
    memo: "",
  };
}

function readContour(value: unknown): CommercialContour {
  return CommercialContourSchema.parse(readString(value).trim() || "rf");
}

function readExecutionStatus(value: unknown) {
  return PaymentOrderExecutionStatusSchema.parse(
    readString(value).trim() || "sent",
  );
}

function buildExternalBasis(values: Record<string, unknown>) {
  const sourceSystem = readString(values.externalBasisSourceSystem).trim();
  const entityType = readString(values.externalBasisEntityType).trim();
  const entityId = readString(values.externalBasisEntityId).trim();

  if (!sourceSystem || !entityType || !entityId) {
    return undefined;
  }

  return {
    sourceSystem,
    entityType,
    entityId,
    documentNumber: optionalString(values.externalBasisDocumentNumber),
  };
}

export function createIncomingInvoicePayload(values: Record<string, unknown>) {
  return parseSchema(IncomingInvoiceInputSchema, {
    contour: readContour(values.contour),
    occurredAt: toOccurredAtIso(values.occurredAt),
    customerId: readString(values.customerId).trim(),
    counterpartyId: readString(values.counterpartyId).trim(),
    organizationId: optionalString(values.organizationId),
    organizationRequisiteId: readString(values.organizationRequisiteId).trim(),
    amount: normalizeCommercialMajorAmountInput(values.amount, values.currency),
    currency: readString(values.currency).trim(),
    externalBasis: buildExternalBasis(values),
    memo: optionalString(values.memo),
  });
}

export function createOutgoingInvoicePayload(values: Record<string, unknown>) {
  return parseSchema(OutgoingInvoiceInputSchema, {
    contour: readContour(values.contour),
    occurredAt: toOccurredAtIso(values.occurredAt),
    counterpartyId: readString(values.counterpartyId).trim(),
    counterpartyRequisiteId: readString(values.counterpartyRequisiteId).trim(),
    organizationId: optionalString(values.organizationId),
    organizationRequisiteId: readString(values.organizationRequisiteId).trim(),
    amount: normalizeCommercialMajorAmountInput(values.amount, values.currency),
    currency: readString(values.currency).trim(),
    memo: optionalString(values.memo),
  });
}

export function createPaymentOrderPayload(values: Record<string, unknown>) {
  return parseSchema(PaymentOrderInputSchema, {
    contour: readContour(values.contour),
    occurredAt: toOccurredAtIso(values.occurredAt),
    incomingInvoiceDocumentId: readString(values.incomingInvoiceDocumentId).trim(),
    sourcePaymentOrderDocumentId: optionalString(
      values.sourcePaymentOrderDocumentId,
    ),
    counterpartyId: readString(values.counterpartyId).trim(),
    counterpartyRequisiteId: readString(values.counterpartyRequisiteId).trim(),
    organizationId: optionalString(values.organizationId),
    organizationRequisiteId: readString(values.organizationRequisiteId).trim(),
    amount: normalizeCommercialMajorAmountInput(values.amount, values.currency),
    currency: readString(values.currency).trim(),
    allocatedCurrency: readString(values.allocatedCurrency).trim(),
    executionStatus: readExecutionStatus(values.executionStatus),
    executionRef: optionalString(values.executionRef),
    memo: optionalString(values.memo),
  });
}

export {
  IncomingInvoiceInputSchema,
  OutgoingInvoiceInputSchema,
  PaymentOrderInputSchema,
  isoToDateTimeLocal,
  nowDateTimeLocal,
  readString,
};
