import {
  COMMERCIAL_CONTOUR_OPTIONS,
  createOutgoingInvoicePayload,
  getDefaultOutgoingInvoiceValues,
  isoToDateTimeLocal,
  readString,
} from "./shared";
import type { CommercialDocumentCatalogEntry } from "./types";
import { OutgoingInvoiceInputSchema } from "../validation";

export const outgoingInvoiceDocumentDefinition = {
  docType: "outgoing_invoice",
  label: "Счет / Invoice",
  family: "commercial",
  docNoPrefix: "OIN",
  schema: OutgoingInvoiceInputSchema,
  creatable: true,
  hasTypedForm: true,
  adminOnly: false,
  listed: true,
  formDefinition: {
    docType: "outgoing_invoice",
    label: "Счет / Invoice",
    family: "commercial",
    schema: OutgoingInvoiceInputSchema,
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
            label: "Реквизит организации",
            counterpartyField: "organizationId",
            optionsSource: "organizationRequisites",
          },
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
            { fields: ["contour", "occurredAt"] },
            {
              columns: { base: 1, sm: 2 },
              fields: ["counterpartyId", "counterpartyRequisiteId"],
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
    ],
    defaultValues: getDefaultOutgoingInvoiceValues,
    fromPayload(payload) {
      return {
        ...getDefaultOutgoingInvoiceValues(),
        contour: readString(payload.contour) === "intl" ? "intl" : "rf",
        occurredAt: isoToDateTimeLocal(payload.occurredAt),
        counterpartyId: readString(payload.counterpartyId),
        counterpartyRequisiteId: readString(payload.counterpartyRequisiteId),
        organizationId: readString(payload.organizationId),
        organizationRequisiteId: readString(payload.organizationRequisiteId),
        amount: readString(payload.amount),
        currency: readString(payload.currency),
        memo: readString(payload.memo),
      };
    },
    toPayload(values) {
      return createOutgoingInvoicePayload(values);
    },
  },
} satisfies CommercialDocumentCatalogEntry;
