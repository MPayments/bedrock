import { PeriodReopenSchema } from "@bedrock/app/ifrs-documents/contracts";

import type { DocumentFormDefinition } from "../types";
import {
  isoToDateInput,
  isoToDateTimeLocal,
  nowDateTimeLocal,
  optionalString,
  parseSchema,
  readString,
  TWO_COLUMN_SM_COLUMNS,
  toOccurredAtIso,
} from "../shared";

export function createPeriodReopenDefinition(): DocumentFormDefinition {
  return {
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
          { kind: "counterparty", name: "counterpartyId", label: "Контрагент" },
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
              fields: ["counterpartyId"],
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
        counterpartyId: "",
        periodStart: today,
        periodEnd: "",
        reopenReason: "",
      };
    },
    fromPayload(payload) {
      return {
        occurredAt: isoToDateTimeLocal(payload.occurredAt),
        counterpartyId: readString(payload.counterpartyId),
        periodStart: isoToDateInput(payload.periodStart),
        periodEnd: isoToDateInput(payload.periodEnd),
        reopenReason: readString(payload.reopenReason),
      };
    },
    toPayload(values) {
      return parseSchema(PeriodReopenSchema, {
        occurredAt: toOccurredAtIso(values.occurredAt),
        counterpartyId: readString(values.counterpartyId).trim(),
        periodStart: readString(values.periodStart).trim(),
        periodEnd: optionalString(values.periodEnd),
        reopenReason: optionalString(values.reopenReason),
      });
    },
  };
}
