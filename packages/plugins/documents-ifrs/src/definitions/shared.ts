import type { z } from "zod";

import { normalizeMajorAmountInput } from "@bedrock/shared/money";

import type {
  AccrualAdjustmentInputSchema,
  ClosingReclassInputSchema,
  EquityContributionInputSchema,
  EquityDistributionInputSchema,
  ImpairmentAdjustmentInputSchema,
  IntercompanyInterestSettlementInputSchema,
  IntercompanyLoanDrawdownInputSchema,
  IntercompanyLoanRepaymentInputSchema,
  RevaluationAdjustmentInputSchema,
} from "../validation";
import type {
  DocumentFormDefinition,
  DocumentFormFieldOption,
  DocumentFormResponsiveCount,
  DocumentFormSectionLayout,
  DocumentFormValues,
} from "./types";

export function nowDateTimeLocal() {
  const now = new Date();
  const offsetMinutes = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - offsetMinutes * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export function isoToDateTimeLocal(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return nowDateTimeLocal();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return nowDateTimeLocal();
  }

  const offsetMinutes = parsed.getTimezoneOffset();
  const localDate = new Date(parsed.getTime() - offsetMinutes * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export function isoToDateInput(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const offsetMinutes = parsed.getTimezoneOffset();
  const localDate = new Date(parsed.getTime() - offsetMinutes * 60_000);
  return localDate.toISOString().slice(0, 10);
}

export function readString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }

  return "";
}

export function optionalString(value: unknown): string | undefined {
  const normalized = readString(value).trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function optionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  const normalized = readString(value).trim();
  if (normalized.length === 0) {
    return undefined;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return Math.trunc(parsed);
}

export function toOccurredAtIso(value: unknown): string {
  const normalized = readString(value).trim();
  if (normalized.length === 0) {
    return new Date().toISOString();
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
}

export function parseSchema<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.input<TSchema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw result.error;
  }

  return input as z.input<TSchema>;
}

export const RUSSIAN_MAJOR_AMOUNT_MESSAGES = {
  invalidNumberMessage: "Сумма должна быть числом, например 1000.50",
  tooManyFractionDigitsMessage: (input: {
    currency: string;
    precision: number;
  }) =>
    `Слишком много знаков после запятой для ${
      input.currency.length > 0 ? input.currency : "выбранной валюты"
    }: максимум ${input.precision}`,
};

function normalizeLocalizedMajorAmountInput(
  amountMajor: unknown,
  currencyCode: unknown,
) {
  return normalizeMajorAmountInput(
    amountMajor,
    currencyCode,
    RUSSIAN_MAJOR_AMOUNT_MESSAGES,
  );
}

export const TRANSFER_RESOLUTION_TYPE_OPTIONS: DocumentFormFieldOption[] = [
  { value: "settle", label: "Исполнение" },
  { value: "void", label: "Аннулирование" },
  { value: "fail", label: "Ошибка" },
];

export const CAPITAL_FUNDING_KIND_OPTIONS: DocumentFormFieldOption[] = [
  { value: "founder_equity", label: "Капитал учредителя" },
  { value: "investor_equity", label: "Капитал инвестора" },
  { value: "shareholder_loan", label: "Заем акционера" },
  { value: "opening_balance", label: "Входящий остаток" },
];

export const TWO_COLUMN_SM_COLUMNS = {
  base: 1,
  sm: 2,
} satisfies DocumentFormResponsiveCount;

export function createAmountSectionLayout(
  textareaFieldName = "memo",
): DocumentFormSectionLayout {
  return {
    rows: [
      {
        columns: TWO_COLUMN_SM_COLUMNS,
        fields: ["amount", "currency"],
      },
      {
        fields: [textareaFieldName],
      },
    ],
  };
}

export function getDefaultTransferValues() {
  return {
    occurredAt: nowDateTimeLocal(),
    organizationId: "",
    sourceOrganizationId: "",
    sourceRequisiteId: "",
    destinationOrganizationId: "",
    destinationRequisiteId: "",
    amount: "",
    currency: "",
    timeoutSeconds: "",
    memo: "",
  } satisfies DocumentFormValues;
}

export function createLoanLikeDefinition(input: {
  docType:
    | "intercompany_loan_drawdown"
    | "intercompany_loan_repayment"
    | "intercompany_interest_settlement";
  label: string;
  schema:
    | typeof IntercompanyLoanDrawdownInputSchema
    | typeof IntercompanyLoanRepaymentInputSchema
    | typeof IntercompanyInterestSettlementInputSchema;
}): DocumentFormDefinition {
  return {
    docType: input.docType,
    label: input.label,
    family: "ifrs",
    schema: input.schema,
    sections: [
      {
        id: "main",
        title: "Основные реквизиты",
        fields: [
          { kind: "datetime", name: "occurredAt", label: "Дата документа" },
          {
            kind: "counterparty",
            name: "debtorCounterpartyId",
            label: "Контрагент-должник",
          },
          {
            kind: "counterparty",
            name: "creditorCounterpartyId",
            label: "Контрагент-кредитор",
          },
          { kind: "text", name: "reference", label: "Референс" },
        ],
        layout: {
          rows: [
            {
              columns: TWO_COLUMN_SM_COLUMNS,
              fields: ["debtorCounterpartyId", "creditorCounterpartyId"],
            },
            {
              fields: ["reference"],
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
          { kind: "currency", name: "currency", label: "Валюта" },
          { kind: "textarea", name: "memo", label: "Комментарий", rows: 3 },
        ],
        layout: createAmountSectionLayout(),
      },
    ],
    defaultValues() {
      return {
        occurredAt: nowDateTimeLocal(),
        debtorCounterpartyId: "",
        creditorCounterpartyId: "",
        amount: "",
        currency: "",
        reference: "",
        memo: "",
      };
    },
    fromPayload(payload) {
      return {
        occurredAt: isoToDateTimeLocal(payload.occurredAt),
        debtorCounterpartyId: readString(payload.debtorCounterpartyId),
        creditorCounterpartyId: readString(payload.creditorCounterpartyId),
        amount: normalizeLocalizedMajorAmountInput(
          payload.amount,
          payload.currency,
        ),
        currency: readString(payload.currency),
        reference: readString(payload.reference),
        memo: readString(payload.memo),
      };
    },
    toPayload(values) {
      return parseSchema(input.schema, {
        occurredAt: toOccurredAtIso(values.occurredAt),
        debtorCounterpartyId: readString(values.debtorCounterpartyId).trim(),
        creditorCounterpartyId: readString(
          values.creditorCounterpartyId,
        ).trim(),
        amount: normalizeLocalizedMajorAmountInput(
          values.amount,
          values.currency,
        ),
        currency: readString(values.currency).trim(),
        reference: optionalString(values.reference),
        memo: optionalString(values.memo),
      });
    },
  };
}

export function createEquityDefinition(input: {
  docType: "equity_contribution" | "equity_distribution";
  label: string;
  schema:
    | typeof EquityContributionInputSchema
    | typeof EquityDistributionInputSchema;
}): DocumentFormDefinition {
  return {
    docType: input.docType,
    label: input.label,
    family: "ifrs",
    schema: input.schema,
    sections: [
      {
        id: "main",
        title: "Основные реквизиты",
        fields: [
          { kind: "datetime", name: "occurredAt", label: "Дата документа" },
          { kind: "counterparty", name: "counterpartyId", label: "Контрагент" },
          {
            kind: "counterparty",
            name: "investorCounterpartyId",
            label: "Контрагент-инвестор",
          },
          { kind: "text", name: "reference", label: "Референс" },
        ],
        layout: {
          rows: [
            {
              columns: TWO_COLUMN_SM_COLUMNS,
              fields: ["counterpartyId", "investorCounterpartyId"],
            },
            {
              fields: ["reference"],
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
          { kind: "currency", name: "currency", label: "Валюта" },
          { kind: "textarea", name: "memo", label: "Комментарий", rows: 3 },
        ],
        layout: createAmountSectionLayout(),
      },
    ],
    defaultValues() {
      return {
        occurredAt: nowDateTimeLocal(),
        counterpartyId: "",
        investorCounterpartyId: "",
        amount: "",
        currency: "",
        reference: "",
        memo: "",
      };
    },
    fromPayload(payload) {
      return {
        occurredAt: isoToDateTimeLocal(payload.occurredAt),
        counterpartyId: readString(payload.counterpartyId),
        investorCounterpartyId: readString(payload.investorCounterpartyId),
        amount: normalizeLocalizedMajorAmountInput(
          payload.amount,
          payload.currency,
        ),
        currency: readString(payload.currency),
        reference: readString(payload.reference),
        memo: readString(payload.memo),
      };
    },
    toPayload(values) {
      return parseSchema(input.schema, {
        occurredAt: toOccurredAtIso(values.occurredAt),
        counterpartyId: readString(values.counterpartyId).trim(),
        investorCounterpartyId: optionalString(values.investorCounterpartyId),
        amount: normalizeLocalizedMajorAmountInput(
          values.amount,
          values.currency,
        ),
        currency: readString(values.currency).trim(),
        reference: optionalString(values.reference),
        memo: optionalString(values.memo),
      });
    },
  };
}

export function createAdjustmentDefinition(input: {
  docType:
    | "accrual_adjustment"
    | "revaluation_adjustment"
    | "impairment_adjustment"
    | "closing_reclass";
  label: string;
  schema:
    | typeof AccrualAdjustmentInputSchema
    | typeof RevaluationAdjustmentInputSchema
    | typeof ImpairmentAdjustmentInputSchema
    | typeof ClosingReclassInputSchema;
}): DocumentFormDefinition {
  return {
    docType: input.docType,
    label: input.label,
    family: "ifrs",
    schema: input.schema,
    sections: [
      {
        id: "main",
        title: "Основные реквизиты",
        fields: [
          { kind: "datetime", name: "occurredAt", label: "Дата документа" },
          { kind: "counterparty", name: "counterpartyId", label: "Контрагент" },
          { kind: "text", name: "reference", label: "Референс" },
        ],
        layout: {
          rows: [
            {
              fields: ["counterpartyId"],
            },
            {
              fields: ["reference"],
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
          { kind: "currency", name: "currency", label: "Валюта" },
          { kind: "textarea", name: "memo", label: "Комментарий", rows: 3 },
        ],
        layout: createAmountSectionLayout(),
      },
    ],
    defaultValues() {
      return {
        occurredAt: nowDateTimeLocal(),
        counterpartyId: "",
        amount: "",
        currency: "",
        reference: "",
        memo: "",
      };
    },
    fromPayload(payload) {
      return {
        occurredAt: isoToDateTimeLocal(payload.occurredAt),
        counterpartyId: readString(payload.counterpartyId),
        amount: normalizeLocalizedMajorAmountInput(
          payload.amount,
          payload.currency,
        ),
        currency: readString(payload.currency),
        reference: readString(payload.reference),
        memo: readString(payload.memo),
      };
    },
    toPayload(values) {
      return parseSchema(input.schema, {
        occurredAt: toOccurredAtIso(values.occurredAt),
        counterpartyId: readString(values.counterpartyId).trim(),
        amount: normalizeLocalizedMajorAmountInput(
          values.amount,
          values.currency,
        ),
        currency: readString(values.currency).trim(),
        reference: optionalString(values.reference),
        memo: optionalString(values.memo),
      });
    },
  };
}
