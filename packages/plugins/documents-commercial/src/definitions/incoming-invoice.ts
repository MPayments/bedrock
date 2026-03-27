import {
  createIncomingInvoicePayload,
  COMMERCIAL_CONTOUR_OPTIONS,
  getDefaultIncomingInvoiceValues,
  isoToDateTimeLocal,
  readString,
} from "./shared";
import type { CommercialDocumentCatalogEntry } from "./types";
import { IncomingInvoiceInputSchema } from "../validation";

export const incomingInvoiceDocumentDefinition = {
  docType: "incoming_invoice",
  label: "Счет на оплату / Invoice",
  family: "commercial",
  docNoPrefix: "IIN",
  schema: IncomingInvoiceInputSchema,
  creatable: true,
  hasTypedForm: true,
  adminOnly: false,
  listed: true,
  formDefinition: {
    docType: "incoming_invoice",
    label: "Счет на оплату / Invoice",
    family: "commercial",
    schema: IncomingInvoiceInputSchema,
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
          { kind: "customer", name: "customerId", label: "Клиент" },
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
          { kind: "amount", name: "amount", label: "Сумма invoice" },
          {
            kind: "currency",
            name: "currency",
            label: "Валюта invoice",
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
            { fields: ["contour", "occurredAt"] },
            {
              columns: { base: 1, sm: 2 },
              fields: ["customerId", "counterpartyId"],
            },
            {
              columns: { base: 1, sm: 2 },
              fields: ["organizationId", "organizationRequisiteId"],
            },
            {
              fields: ["amount"],
            },
            { fields: ["memo"] },
          ],
        },
      },
      {
        id: "external-basis",
        title: "Внешнее основание",
        description: "Опционально: ссылка на CRM-документ или сделку.",
        fields: [
          {
            kind: "text",
            name: "externalBasisSourceSystem",
            label: "Система-источник",
          },
          {
            kind: "text",
            name: "externalBasisEntityType",
            label: "Тип сущности",
          },
          {
            kind: "text",
            name: "externalBasisEntityId",
            label: "ID сущности",
          },
          {
            kind: "text",
            name: "externalBasisDocumentNumber",
            label: "Номер документа",
          },
        ],
        layout: {
          rows: [
            {
              columns: { base: 1, sm: 2 },
              fields: ["externalBasisSourceSystem", "externalBasisEntityType"],
            },
            {
              columns: { base: 1, sm: 2 },
              fields: ["externalBasisEntityId", "externalBasisDocumentNumber"],
            },
          ],
        },
      },
    ],
    defaultValues: getDefaultIncomingInvoiceValues,
    fromPayload(payload) {
      const contour = readString(payload.contour) === "intl" ? "intl" : "rf";
      const externalBasis =
        typeof payload.externalBasis === "object" && payload.externalBasis !== null
          ? (payload.externalBasis as Record<string, unknown>)
          : null;

      return {
        ...getDefaultIncomingInvoiceValues(),
        contour,
        occurredAt: isoToDateTimeLocal(payload.occurredAt),
        customerId: readString(payload.customerId),
        counterpartyId: readString(payload.counterpartyId),
        organizationId: readString(payload.organizationId),
        organizationRequisiteId: readString(payload.organizationRequisiteId),
        amount: readString(payload.amount),
        currency: readString(payload.currency),
        externalBasisSourceSystem: readString(externalBasis?.sourceSystem),
        externalBasisEntityType: readString(externalBasis?.entityType),
        externalBasisEntityId: readString(externalBasis?.entityId),
        externalBasisDocumentNumber: readString(externalBasis?.documentNumber),
        memo: readString(payload.memo),
      };
    },
    toPayload(values) {
      return createIncomingInvoicePayload(values);
    },
  },
} satisfies CommercialDocumentCatalogEntry;
