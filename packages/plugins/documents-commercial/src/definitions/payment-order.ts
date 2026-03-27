import {
  COMMERCIAL_CONTOUR_OPTIONS,
  createPaymentOrderPayload,
  getDefaultPaymentOrderValues,
  isoToDateTimeLocal,
  PAYMENT_ORDER_EXECUTION_STATUS_OPTIONS,
  readString,
} from "./shared";
import type { CommercialDocumentCatalogEntry } from "./types";
import { PaymentOrderInputSchema } from "../validation";

export const paymentOrderDocumentDefinition = {
  docType: "payment_order",
  label: "Платежное поручение / Payment Order",
  family: "commercial",
  docNoPrefix: "PPO",
  schema: PaymentOrderInputSchema,
  creatable: true,
  hasTypedForm: true,
  adminOnly: false,
  listed: true,
  formDefinition: {
    docType: "payment_order",
    label: "Платежное поручение / Payment Order",
    family: "commercial",
    schema: PaymentOrderInputSchema,
    sections: [
      {
        id: "main",
        title: "Основные реквизиты",
        fields: [
          {
            kind: "enum",
            name: "contour",
            label: "Контур",
            options: [...COMMERCIAL_CONTOUR_OPTIONS],
          },
          { kind: "datetime", name: "occurredAt", label: "Дата документа" },
          {
            kind: "text",
            name: "incomingInvoiceDocumentId",
            label: "UUID входящего invoice",
          },
          {
            kind: "text",
            name: "sourcePaymentOrderDocumentId",
            label: "UUID исходного payment order",
          },
          { kind: "counterparty", name: "counterpartyId", label: "Контрагент" },
          {
            kind: "account",
            name: "counterpartyRequisiteId",
            label: "Реквизит контрагента",
            counterpartyField: "counterpartyId",
            optionsSource: "counterpartyRequisites",
          },
          {
            kind: "counterparty",
            name: "organizationId",
            label: "Организация",
            optionsSource: "organizations",
          },
          {
            kind: "account",
            name: "organizationRequisiteId",
            label: "Реквизит списания",
            counterpartyField: "organizationId",
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
            label: "Валюта списания",
            hidden: true,
            deriveFrom: {
              kind: "accountCurrency",
              accountFieldNames: ["organizationRequisiteId"],
            },
          },
          {
            kind: "currency",
            name: "allocatedCurrency",
            label: "Валюта invoice",
          },
          {
            kind: "fxQuotePreview",
            name: "quotePreview",
            label: "FX preview",
            requestMode: "auto_cross",
            amountFieldName: "amount",
            fromCurrencyFieldName: "currency",
            toCurrencyFieldName: "allocatedCurrency",
          },
          {
            kind: "enum",
            name: "executionStatus",
            label: "Статус исполнения",
            options: [...PAYMENT_ORDER_EXECUTION_STATUS_OPTIONS],
          },
          {
            kind: "text",
            name: "executionRef",
            label: "Референс исполнения",
          },
          { kind: "textarea", name: "memo", label: "Комментарий", rows: 3 },
        ],
        layout: {
          rows: [
            { fields: ["contour", "occurredAt"] },
            { fields: ["incomingInvoiceDocumentId"] },
            { fields: ["sourcePaymentOrderDocumentId"] },
            {
              columns: { base: 1, sm: 2 },
              fields: ["counterpartyId", "counterpartyRequisiteId"],
            },
            {
              columns: { base: 1, sm: 2 },
              fields: ["organizationId", "organizationRequisiteId"],
            },
            {
              columns: { base: 1, sm: 2 },
              fields: ["amount", "allocatedCurrency"],
            },
            { fields: ["quotePreview"] },
            {
              columns: { base: 1, sm: 2 },
              fields: ["executionStatus", "executionRef"],
            },
            { fields: ["memo"] },
          ],
        },
      },
    ],
    defaultValues: getDefaultPaymentOrderValues,
    fromPayload(payload) {
      return {
        ...getDefaultPaymentOrderValues(),
        contour: readString(payload.contour) === "intl" ? "intl" : "rf",
        occurredAt: isoToDateTimeLocal(payload.occurredAt),
        incomingInvoiceDocumentId: readString(payload.incomingInvoiceDocumentId),
        sourcePaymentOrderDocumentId: readString(
          payload.sourcePaymentOrderDocumentId,
        ),
        counterpartyId: readString(payload.counterpartyId),
        counterpartyRequisiteId: readString(payload.counterpartyRequisiteId),
        organizationId: readString(payload.organizationId),
        organizationRequisiteId: readString(payload.organizationRequisiteId),
        amount: readString(payload.fundingAmount),
        currency: readString(payload.fundingCurrency),
        allocatedCurrency: readString(payload.allocatedCurrency),
        executionStatus: readString(payload.executionStatus) || "sent",
        executionRef: readString(payload.executionRef),
        memo: readString(payload.memo),
      };
    },
    toPayload(values) {
      return createPaymentOrderPayload(values);
    },
  },
} satisfies CommercialDocumentCatalogEntry;
