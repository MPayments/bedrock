import { PeriodReopenSchema } from "../validation";
import {
  isoToDateInput,
  isoToDateTimeLocal,
  nowDateTimeLocal,
  optionalString,
  parseSchema,
  readString,
  TWO_COLUMN_SM_COLUMNS,
  toOccurredAtIso,
} from "./shared";
import type { IfrsDocumentCatalogEntry } from "./types";

export const periodReopenDocumentDefinition = {
  docType: "period_reopen",
  label: "Переоткрытие периода",
  family: "ifrs",
  docNoPrefix: "PRN",
  schema: PeriodReopenSchema,
  creatable: true,
  hasTypedForm: true,
  adminOnly: true,
  listed: true,
  formDefinition: {
    docType: "period_reopen",
    label: "Переоткрытие периода",
    family: "ifrs",
    adminOnly: true,
    schema: PeriodReopenSchema,
    sections: [
      {
        id: "main",
        title: "Параметры переоткрытия",
        fields: [
          { kind: "datetime", name: "occurredAt", label: "Дата документа" },
          {
            kind: "counterparty",
            name: "organizationId",
            label: "Организация",
            optionsSource: "organizations",
          },
          { kind: "date", name: "periodStart", label: "Начало периода" },
          { kind: "date", name: "periodEnd", label: "Окончание периода" },
          {
            kind: "textarea",
            name: "reopenReason",
            label: "Причина переоткрытия",
            rows: 3,
          },
        ],
        layout: {
          rows: [
            {
              fields: ["organizationId"],
            },
            {
              columns: TWO_COLUMN_SM_COLUMNS,
              fields: ["periodStart", "periodEnd"],
            },
            {
              fields: ["occurredAt"],
            },
            {
              fields: ["reopenReason"],
            },
          ],
        },
      },
    ],
    defaultValues() {
      const today = new Date().toISOString().slice(0, 10);
      return {
        occurredAt: nowDateTimeLocal(),
        organizationId: "",
        periodStart: today,
        periodEnd: "",
        reopenReason: "",
      };
    },
    fromPayload(payload) {
      return {
        occurredAt: isoToDateTimeLocal(payload.occurredAt),
        organizationId: readString(payload.organizationId),
        periodStart: isoToDateInput(payload.periodStart),
        periodEnd: isoToDateInput(payload.periodEnd),
        reopenReason: readString(payload.reopenReason),
      };
    },
    toPayload(values) {
      return parseSchema(PeriodReopenSchema, {
        occurredAt: toOccurredAtIso(values.occurredAt),
        organizationId: readString(values.organizationId).trim(),
        periodStart: readString(values.periodStart).trim(),
        periodEnd: optionalString(values.periodEnd),
        reopenReason: optionalString(values.reopenReason),
      });
    },
  },
} satisfies IfrsDocumentCatalogEntry;
