import { TransferIntercompanyInputSchema } from "../validation";
import {
  getDefaultTransferValues,
  isoToDateTimeLocal,
  normalizeMajorAmountInput,
  optionalNumber,
  optionalString,
  parseSchema,
  readString,
  TWO_COLUMN_SM_COLUMNS,
  toOccurredAtIso,
} from "./shared";
import type { IfrsDocumentCatalogEntry } from "./types";

export const transferIntercompanyDocumentDefinition = {
  docType: "transfer_intercompany",
  label: "Межкорпоративный перевод",
  family: "transfers",
  docNoPrefix: "TRX",
  schema: TransferIntercompanyInputSchema,
  creatable: true,
  hasTypedForm: true,
  adminOnly: false,
  listed: true,
  formDefinition: {
    docType: "transfer_intercompany",
    label: "Межкорпоративный перевод",
    family: "transfers",
    schema: TransferIntercompanyInputSchema,
    sections: [
      {
        id: "main",
        title: "Основные реквизиты",
        fields: [
          { kind: "datetime", name: "occurredAt", label: "Дата документа" },
          {
            kind: "counterparty",
            name: "sourceOrganizationId",
            label: "Организация источник",
            optionsSource: "organizations",
          },
          {
            kind: "account",
            name: "sourceRequisiteId",
            label: "Реквизит источник",
            counterpartyField: "sourceOrganizationId",
            optionsSource: "organizationRequisites",
          },
          {
            kind: "counterparty",
            name: "destinationOrganizationId",
            label: "Организация назначение",
            optionsSource: "organizations",
          },
          {
            kind: "account",
            name: "destinationRequisiteId",
            label: "Реквизит назначение",
            counterpartyField: "destinationOrganizationId",
            optionsSource: "organizationRequisites",
          },
        ],
        layout: {
          rows: [
            {
              columns: TWO_COLUMN_SM_COLUMNS,
              fields: ["sourceOrganizationId", "destinationOrganizationId"],
            },
            {
              columns: TWO_COLUMN_SM_COLUMNS,
              fields: ["sourceRequisiteId", "destinationRequisiteId"],
            },
            {
              fields: ["occurredAt"],
            },
          ],
        },
      },
      {
        id: "amount",
        title: "Сумма",
        fields: [
          { kind: "amount", name: "amount", label: "Сумма" },
          {
            kind: "currency",
            name: "currency",
            label: "Валюта",
            hidden: true,
            deriveFrom: {
              kind: "accountCurrency",
              accountFieldNames: ["sourceRequisiteId", "destinationRequisiteId"],
            },
          },
          {
            kind: "number",
            name: "timeoutSeconds",
            label: "Таймаут (секунды)",
            min: 1,
            step: 1,
            description:
              "Опционально. Для pending-перевода задайте TTL в секундах.",
          },
          { kind: "textarea", name: "memo", label: "Комментарий", rows: 3 },
        ],
        layout: {
          rows: [
            {
              fields: ["amount"],
            },
            {
              fields: ["timeoutSeconds"],
            },
            {
              fields: ["memo"],
            },
          ],
        },
      },
    ],
    defaultValues: getDefaultTransferValues,
    fromPayload(payload) {
      return {
        ...getDefaultTransferValues(),
        occurredAt: isoToDateTimeLocal(payload.occurredAt),
        sourceOrganizationId: readString(payload.sourceOrganizationId),
        sourceRequisiteId: readString(payload.sourceRequisiteId),
        destinationOrganizationId: readString(payload.destinationOrganizationId),
        destinationRequisiteId: readString(payload.destinationRequisiteId),
        amount: normalizeMajorAmountInput(payload.amount, payload.currency),
        currency: readString(payload.currency),
        timeoutSeconds:
          typeof payload.timeoutSeconds === "number"
            ? payload.timeoutSeconds
            : readString(payload.timeoutSeconds),
        memo: readString(payload.memo),
      };
    },
    toPayload(values) {
      return parseSchema(TransferIntercompanyInputSchema, {
        occurredAt: toOccurredAtIso(values.occurredAt),
        sourceOrganizationId: readString(values.sourceOrganizationId).trim(),
        sourceRequisiteId: readString(values.sourceRequisiteId).trim(),
        destinationOrganizationId: readString(
          values.destinationOrganizationId,
        ).trim(),
        destinationRequisiteId: readString(values.destinationRequisiteId).trim(),
        amount: normalizeMajorAmountInput(values.amount, values.currency),
        currency: readString(values.currency).trim(),
        timeoutSeconds: optionalNumber(values.timeoutSeconds),
        memo: optionalString(values.memo),
      });
    },
  },
} satisfies IfrsDocumentCatalogEntry;
