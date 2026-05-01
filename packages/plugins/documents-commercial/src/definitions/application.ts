import {
  createApplicationPayload,
  getDefaultApplicationValues,
  isoToDateTimeLocal,
  readString,
} from "./shared";
import type { CommercialDocumentCatalogEntry } from "./types";
import { ApplicationInputSchema, ApplicationPayloadSchema } from "../validation";

export const applicationDocumentDefinition = {
  docType: "application",
  label: "Поручение",
  family: "commercial",
  docNoPrefix: "APP",
  schema: ApplicationInputSchema,
  creatable: true,
  hasTypedForm: true,
  adminOnly: false,
  listed: true,
  formDefinition: {
    docType: "application",
    label: "Поручение",
    family: "commercial",
    schema: ApplicationInputSchema,
    sections: [
      {
        id: "main",
        title: "Основные реквизиты",
        fields: [
          { kind: "datetime", name: "occurredAt", label: "Дата документа" },
          { kind: "text", name: "dealId", label: "Сделка", hidden: true },
          { kind: "text", name: "quoteId", label: "Котировка", hidden: true },
          {
            kind: "text",
            name: "calculationId",
            label: "Расчет",
            hidden: true,
          },
          { kind: "text", name: "customerId", label: "Клиент", hidden: true },
          {
            kind: "text",
            name: "counterpartyId",
            label: "Контрагент",
            hidden: true,
          },
          {
            kind: "text",
            name: "organizationId",
            label: "Организация",
            hidden: true,
          },
          {
            kind: "text",
            name: "organizationRequisiteId",
            label: "Реквизит организации",
            hidden: true,
          },
          { kind: "textarea", name: "memo", label: "Комментарий", rows: 3 },
        ],
        layout: {
          rows: [
            { fields: ["occurredAt"] },
            { fields: ["memo"] },
          ],
        },
      },
    ],
    defaultValues: getDefaultApplicationValues,
    fromPayload(payload) {
      const normalized = ApplicationPayloadSchema.parse(payload);

      return {
        ...getDefaultApplicationValues(),
        occurredAt: isoToDateTimeLocal(normalized.occurredAt),
        dealId: normalized.dealId,
        quoteId: normalized.quoteId,
        calculationId: normalized.calculationId,
        customerId: normalized.customerId,
        counterpartyId: normalized.counterpartyId,
        organizationId: normalized.organizationId,
        organizationRequisiteId: normalized.organizationRequisiteId,
        memo: readString(normalized.memo),
      };
    },
    toPayload(values) {
      return createApplicationPayload(values);
    },
  },
} satisfies CommercialDocumentCatalogEntry;
