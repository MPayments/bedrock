import {
  AccrualAdjustmentInputSchema,
  CapitalFundingInputSchema,
  ClosingReclassInputSchema,
  EquityContributionInputSchema,
  EquityDistributionInputSchema,
  ImpairmentAdjustmentInputSchema,
  IntercompanyInterestAccrualInputSchema,
  IntercompanyInterestSettlementInputSchema,
  IntercompanyLoanDrawdownInputSchema,
  IntercompanyLoanRepaymentInputSchema,
  PeriodReopenSchema,
  RevaluationAdjustmentInputSchema,
  TransferIntercompanyInputSchema,
  TransferIntraInputSchema,
  TransferResolutionInputSchema,
} from "@bedrock/application/ifrs-documents/validation";
import { z } from "zod";

import type { UserRole } from "@/lib/auth/types";
import type { TypedDocumentType } from "@/features/documents/lib/doc-types";

export type DocumentFormFieldOption = {
  value: string;
  label: string;
};

type DocumentFormFieldBase = {
  name: string;
  label: string;
  description?: string;
  placeholder?: string;
};

type DocumentFormFieldInput =
  | (DocumentFormFieldBase & {
      kind: "datetime" | "date" | "month" | "text" | "amountMinor";
    })
  | (DocumentFormFieldBase & {
      kind: "textarea";
      rows?: number;
    })
  | (DocumentFormFieldBase & {
      kind: "number";
      min?: number;
      step?: number;
    })
  | (DocumentFormFieldBase & {
      kind: "enum";
      options: DocumentFormFieldOption[];
    })
  | (DocumentFormFieldBase & {
      kind: "counterparty" | "currency";
    })
  | (DocumentFormFieldBase & {
      kind: "account";
      counterpartyField: string;
    });

export type DocumentFormField = DocumentFormFieldInput;

export type DocumentFormSection = {
  id: string;
  title: string;
  description?: string;
  fields: DocumentFormField[];
};

type DocumentFormValues = Record<string, unknown>;

export type DocumentFormDefinition = {
  docType: TypedDocumentType;
  label: string;
  family: "transfers" | "ifrs";
  adminOnly?: boolean;
  schema: z.ZodTypeAny;
  sections: DocumentFormSection[];
  defaultValues: () => DocumentFormValues;
  fromPayload: (payload: Record<string, unknown>) => DocumentFormValues;
  toPayload: (values: DocumentFormValues) => unknown;
};

function nowDateTimeLocal() {
  const now = new Date();
  const offsetMinutes = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - offsetMinutes * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function isoToDateTimeLocal(value: unknown): string {
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

function isoToDateInput(value: unknown): string {
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

function readString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }

  return "";
}

function optionalString(value: unknown): string | undefined {
  const normalized = readString(value).trim();
  return normalized.length > 0 ? normalized : undefined;
}

function optionalNumber(value: unknown): number | undefined {
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

function toOccurredAtIso(value: unknown): string {
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

function parseSchema<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.input<TSchema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw result.error;
  }

  // Keep API payload shape as entered in UI.
  // Some schemas include service-layer transforms (amount -> amountMinor),
  // and those must not be applied on the client.
  return input as z.input<TSchema>;
}

function resolveCurrencyPrecision(currencyCode: unknown): number {
  const normalized = readString(currencyCode).trim().toUpperCase();
  if (normalized.length === 0) {
    return 2;
  }

  try {
    const options = new Intl.NumberFormat("en", {
      style: "currency",
      currency: normalized,
    }).resolvedOptions();
    return Math.max(0, Math.trunc(options.maximumFractionDigits ?? 2));
  } catch {
    return 2;
  }
}

function toMajorAmountInput(
  amountMinor: unknown,
  currencyCode: unknown,
): string {
  const normalizedMinor = readString(amountMinor).trim();
  if (normalizedMinor.length === 0) {
    return "";
  }

  let minorAmount: bigint;
  try {
    minorAmount = BigInt(normalizedMinor);
  } catch {
    return normalizedMinor;
  }

  const precision = resolveCurrencyPrecision(currencyCode);
  const isNegative = minorAmount < 0n;
  const absoluteMinor = isNegative ? -minorAmount : minorAmount;

  if (precision === 0) {
    return `${isNegative ? "-" : ""}${absoluteMinor.toString()}`;
  }

  const base = absoluteMinor.toString().padStart(precision + 1, "0");
  const integerPart = base.slice(0, -precision);
  const fractionPart = base.slice(-precision).replace(/0+$/, "");
  const major =
    fractionPart.length > 0 ? `${integerPart}.${fractionPart}` : integerPart;

  return `${isNegative ? "-" : ""}${major}`;
}

function normalizeMajorAmountInput(
  amountMajor: unknown,
  currencyCode: unknown,
): string {
  const normalizedMajor = readString(amountMajor).trim().replace(",", ".");
  if (normalizedMajor.length === 0) {
    return "";
  }

  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(normalizedMajor);
  if (!match) {
    throw new Error("Сумма должна быть числом, например 1000.50");
  }

  const [, signRaw = "", integerRaw = "", fractionRaw = ""] = match;
  const precision = resolveCurrencyPrecision(currencyCode);
  if (fractionRaw.length > precision) {
    const currency = readString(currencyCode).trim().toUpperCase();
    throw new Error(
      `Слишком много знаков после запятой для ${
        currency.length > 0 ? currency : "выбранной валюты"
      }: максимум ${precision}`,
    );
  }

  const normalizedInteger = integerRaw.replace(/^0+(?=\d)/, "");
  const normalizedFraction = fractionRaw.replace(/0+$/, "");
  const isZero =
    /^0+$/.test(normalizedInteger.length > 0 ? normalizedInteger : "0") &&
    normalizedFraction.length === 0;
  const sign = signRaw === "-" && !isZero ? "-" : "";

  if (normalizedFraction.length === 0) {
    return `${sign}${normalizedInteger.length > 0 ? normalizedInteger : "0"}`;
  }

  return `${sign}${normalizedInteger}.${normalizedFraction}`;
}

const TRANSFER_RESOLUTION_TYPE_OPTIONS: DocumentFormFieldOption[] = [
  { value: "settle", label: "Исполнение" },
  { value: "void", label: "Аннулирование" },
  { value: "fail", label: "Ошибка" },
];

const CAPITAL_FUNDING_KIND_OPTIONS: DocumentFormFieldOption[] = [
  { value: "founder_equity", label: "Капитал учредителя" },
  { value: "investor_equity", label: "Капитал инвестора" },
  { value: "shareholder_loan", label: "Заем акционера" },
  { value: "opening_balance", label: "Входящий остаток" },
];

function getDefaultTransferValues() {
  return {
    occurredAt: nowDateTimeLocal(),
    sourceCounterpartyId: "",
    sourceCounterpartyAccountId: "",
    destinationCounterpartyId: "",
    destinationCounterpartyAccountId: "",
    amountMinor: "",
    currency: "",
    timeoutSeconds: "",
    memo: "",
  } satisfies DocumentFormValues;
}

function createTransferIntraDefinition(): DocumentFormDefinition {
  return {
    docType: "transfer_intra",
    label: "Внутренний перевод",
    family: "transfers",
    schema: TransferIntraInputSchema,
    sections: [
      {
        id: "main",
        title: "Основные реквизиты",
        fields: [
          { kind: "datetime", name: "occurredAt", label: "Дата документа" },
          {
            kind: "counterparty",
            name: "sourceCounterpartyId",
            label: "Контрагент",
            description:
              "Счета источника и назначения должны принадлежать одному контрагенту.",
          },
          {
            kind: "account",
            name: "sourceCounterpartyAccountId",
            label: "Счет источник",
            counterpartyField: "sourceCounterpartyId",
          },
          {
            kind: "account",
            name: "destinationCounterpartyAccountId",
            label: "Счет назначение",
            counterpartyField: "sourceCounterpartyId",
          },
        ],
      },
      {
        id: "amount",
        title: "Сумма",
        fields: [
          { kind: "amountMinor", name: "amountMinor", label: "Сумма" },
          { kind: "currency", name: "currency", label: "Валюта" },
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
      },
    ],
    defaultValues: getDefaultTransferValues,
    fromPayload(payload) {
      return {
        ...getDefaultTransferValues(),
        occurredAt: isoToDateTimeLocal(payload.occurredAt),
        sourceCounterpartyId: readString(payload.sourceCounterpartyId),
        sourceCounterpartyAccountId: readString(
          payload.sourceCounterpartyAccountId,
        ),
        destinationCounterpartyAccountId: readString(
          payload.destinationCounterpartyAccountId,
        ),
        amountMinor: toMajorAmountInput(payload.amountMinor, payload.currency),
        currency: readString(payload.currency),
        timeoutSeconds:
          typeof payload.timeoutSeconds === "number"
            ? payload.timeoutSeconds
            : readString(payload.timeoutSeconds),
        memo: readString(payload.memo),
      };
    },
    toPayload(values) {
      return parseSchema(TransferIntraInputSchema, {
        occurredAt: toOccurredAtIso(values.occurredAt),
        sourceCounterpartyAccountId: readString(
          values.sourceCounterpartyAccountId,
        ).trim(),
        destinationCounterpartyAccountId: readString(
          values.destinationCounterpartyAccountId,
        ).trim(),
        amount: normalizeMajorAmountInput(values.amountMinor, values.currency),
        currency: readString(values.currency).trim(),
        timeoutSeconds: optionalNumber(values.timeoutSeconds),
        memo: optionalString(values.memo),
      });
    },
  };
}

function createTransferIntercompanyDefinition(): DocumentFormDefinition {
  return {
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
            name: "sourceCounterpartyId",
            label: "Контрагент источник",
          },
          {
            kind: "account",
            name: "sourceCounterpartyAccountId",
            label: "Счет источник",
            counterpartyField: "sourceCounterpartyId",
          },
          {
            kind: "counterparty",
            name: "destinationCounterpartyId",
            label: "Контрагент назначение",
          },
          {
            kind: "account",
            name: "destinationCounterpartyAccountId",
            label: "Счет назначение",
            counterpartyField: "destinationCounterpartyId",
          },
        ],
      },
      {
        id: "amount",
        title: "Сумма",
        fields: [
          { kind: "amountMinor", name: "amountMinor", label: "Сумма" },
          { kind: "currency", name: "currency", label: "Валюта" },
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
      },
    ],
    defaultValues: getDefaultTransferValues,
    fromPayload(payload) {
      return {
        ...getDefaultTransferValues(),
        occurredAt: isoToDateTimeLocal(payload.occurredAt),
        sourceCounterpartyId: readString(payload.sourceCounterpartyId),
        sourceCounterpartyAccountId: readString(
          payload.sourceCounterpartyAccountId,
        ),
        destinationCounterpartyId: readString(
          payload.destinationCounterpartyId,
        ),
        destinationCounterpartyAccountId: readString(
          payload.destinationCounterpartyAccountId,
        ),
        amountMinor: toMajorAmountInput(payload.amountMinor, payload.currency),
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
        sourceCounterpartyAccountId: readString(
          values.sourceCounterpartyAccountId,
        ).trim(),
        destinationCounterpartyAccountId: readString(
          values.destinationCounterpartyAccountId,
        ).trim(),
        amount: normalizeMajorAmountInput(values.amountMinor, values.currency),
        currency: readString(values.currency).trim(),
        timeoutSeconds: optionalNumber(values.timeoutSeconds),
        memo: optionalString(values.memo),
      });
    },
  };
}

function createTransferResolutionDefinition(): DocumentFormDefinition {
  return {
    docType: "transfer_resolution",
    label: "Разрешение перевода",
    family: "transfers",
    schema: TransferResolutionInputSchema,
    sections: [
      {
        id: "main",
        title: "Основные реквизиты",
        fields: [
          { kind: "datetime", name: "occurredAt", label: "Дата документа" },
          {
            kind: "text",
            name: "transferDocumentId",
            label: "Идентификатор документа перевода",
            placeholder: "UUID документа перевода",
          },
          {
            kind: "enum",
            name: "resolutionType",
            label: "Тип разрешения",
            options: TRANSFER_RESOLUTION_TYPE_OPTIONS,
          },
          {
            kind: "text",
            name: "eventIdempotencyKey",
            label: "Ключ идемпотентности события",
            placeholder: "evt:...",
          },
          {
            kind: "number",
            name: "pendingIndex",
            label: "Индекс ожидающего перевода",
            min: 0,
            step: 1,
          },
          { kind: "textarea", name: "memo", label: "Комментарий", rows: 3 },
        ],
      },
    ],
    defaultValues() {
      return {
        occurredAt: nowDateTimeLocal(),
        transferDocumentId: "",
        resolutionType: "settle",
        eventIdempotencyKey: "",
        pendingIndex: 0,
        memo: "",
      };
    },
    fromPayload(payload) {
      return {
        occurredAt: isoToDateTimeLocal(payload.occurredAt),
        transferDocumentId: readString(payload.transferDocumentId),
        resolutionType: readString(payload.resolutionType) || "settle",
        eventIdempotencyKey: readString(payload.eventIdempotencyKey),
        pendingIndex:
          typeof payload.pendingIndex === "number"
            ? payload.pendingIndex
            : (optionalNumber(payload.pendingIndex) ?? 0),
        memo: readString(payload.memo),
      };
    },
    toPayload(values) {
      return parseSchema(TransferResolutionInputSchema, {
        occurredAt: toOccurredAtIso(values.occurredAt),
        transferDocumentId: readString(values.transferDocumentId).trim(),
        resolutionType: readString(values.resolutionType).trim(),
        eventIdempotencyKey: readString(values.eventIdempotencyKey).trim(),
        pendingIndex: optionalNumber(values.pendingIndex) ?? 0,
        memo: optionalString(values.memo),
      });
    },
  };
}

function createCapitalFundingDefinition(): DocumentFormDefinition {
  return {
    docType: "capital_funding",
    label: "Капитальное финансирование",
    family: "ifrs",
    schema: CapitalFundingInputSchema,
    sections: [
      {
        id: "main",
        title: "Основные реквизиты",
        fields: [
          { kind: "datetime", name: "occurredAt", label: "Дата документа" },
          {
            kind: "enum",
            name: "kind",
            label: "Тип финансирования",
            options: CAPITAL_FUNDING_KIND_OPTIONS,
          },
          { kind: "text", name: "entryRef", label: "Ссылка на запись" },
          { kind: "counterparty", name: "counterpartyId", label: "Контрагент" },
          {
            kind: "account",
            name: "counterpartyAccountId",
            label: "Счет контрагента",
            counterpartyField: "counterpartyId",
          },
        ],
      },
      {
        id: "amount",
        title: "Сумма",
        fields: [
          { kind: "amountMinor", name: "amountMinor", label: "Сумма" },
          { kind: "currency", name: "currency", label: "Валюта" },
          { kind: "textarea", name: "memo", label: "Комментарий", rows: 3 },
        ],
      },
    ],
    defaultValues() {
      return {
        occurredAt: nowDateTimeLocal(),
        kind: "founder_equity",
        entryRef: "",
        counterpartyId: "",
        counterpartyAccountId: "",
        amountMinor: "",
        currency: "",
        memo: "",
      };
    },
    fromPayload(payload) {
      return {
        occurredAt: isoToDateTimeLocal(payload.occurredAt),
        kind: readString(payload.kind) || "founder_equity",
        entryRef: readString(payload.entryRef),
        counterpartyId: readString(payload.counterpartyId),
        counterpartyAccountId: readString(payload.counterpartyAccountId),
        amountMinor: toMajorAmountInput(payload.amountMinor, payload.currency),
        currency: readString(payload.currency),
        memo: readString(payload.memo),
      };
    },
    toPayload(values) {
      return parseSchema(CapitalFundingInputSchema, {
        occurredAt: toOccurredAtIso(values.occurredAt),
        kind: readString(values.kind).trim(),
        entryRef: readString(values.entryRef).trim(),
        counterpartyId: readString(values.counterpartyId).trim(),
        counterpartyAccountId: readString(values.counterpartyAccountId).trim(),
        amount: normalizeMajorAmountInput(values.amountMinor, values.currency),
        currency: readString(values.currency).trim(),
        memo: optionalString(values.memo),
      });
    },
  };
}

function createLoanLikeDefinition(input: {
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
      },
      {
        id: "amount",
        title: "Сумма",
        fields: [
          { kind: "amountMinor", name: "amountMinor", label: "Сумма" },
          { kind: "currency", name: "currency", label: "Валюта" },
          { kind: "textarea", name: "memo", label: "Комментарий", rows: 3 },
        ],
      },
    ],
    defaultValues() {
      return {
        occurredAt: nowDateTimeLocal(),
        debtorCounterpartyId: "",
        creditorCounterpartyId: "",
        amountMinor: "",
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
        amountMinor: toMajorAmountInput(payload.amountMinor, payload.currency),
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
        amount: normalizeMajorAmountInput(values.amountMinor, values.currency),
        currency: readString(values.currency).trim(),
        reference: optionalString(values.reference),
        memo: optionalString(values.memo),
      });
    },
  };
}

function createInterestAccrualDefinition(): DocumentFormDefinition {
  return {
    docType: "intercompany_interest_accrual",
    label: "Начисление межкорпоративных процентов",
    family: "ifrs",
    schema: IntercompanyInterestAccrualInputSchema,
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
          {
            kind: "month",
            name: "accrualPeriodMonth",
            label: "Месяц периода начисления",
          },
          { kind: "text", name: "reference", label: "Референс" },
        ],
      },
      {
        id: "amount",
        title: "Сумма",
        fields: [
          { kind: "amountMinor", name: "amountMinor", label: "Сумма" },
          { kind: "currency", name: "currency", label: "Валюта" },
          { kind: "textarea", name: "memo", label: "Комментарий", rows: 3 },
        ],
      },
    ],
    defaultValues() {
      return {
        occurredAt: nowDateTimeLocal(),
        debtorCounterpartyId: "",
        creditorCounterpartyId: "",
        amountMinor: "",
        currency: "",
        accrualPeriodMonth: "",
        reference: "",
        memo: "",
      };
    },
    fromPayload(payload) {
      return {
        occurredAt: isoToDateTimeLocal(payload.occurredAt),
        debtorCounterpartyId: readString(payload.debtorCounterpartyId),
        creditorCounterpartyId: readString(payload.creditorCounterpartyId),
        amountMinor: toMajorAmountInput(payload.amountMinor, payload.currency),
        currency: readString(payload.currency),
        accrualPeriodMonth: readString(payload.accrualPeriodMonth),
        reference: readString(payload.reference),
        memo: readString(payload.memo),
      };
    },
    toPayload(values) {
      return parseSchema(IntercompanyInterestAccrualInputSchema, {
        occurredAt: toOccurredAtIso(values.occurredAt),
        debtorCounterpartyId: readString(values.debtorCounterpartyId).trim(),
        creditorCounterpartyId: readString(
          values.creditorCounterpartyId,
        ).trim(),
        amount: normalizeMajorAmountInput(values.amountMinor, values.currency),
        currency: readString(values.currency).trim(),
        accrualPeriodMonth: optionalString(values.accrualPeriodMonth),
        reference: optionalString(values.reference),
        memo: optionalString(values.memo),
      });
    },
  };
}

function createEquityDefinition(input: {
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
      },
      {
        id: "amount",
        title: "Сумма",
        fields: [
          { kind: "amountMinor", name: "amountMinor", label: "Сумма" },
          { kind: "currency", name: "currency", label: "Валюта" },
          { kind: "textarea", name: "memo", label: "Комментарий", rows: 3 },
        ],
      },
    ],
    defaultValues() {
      return {
        occurredAt: nowDateTimeLocal(),
        counterpartyId: "",
        investorCounterpartyId: "",
        amountMinor: "",
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
        amountMinor: toMajorAmountInput(payload.amountMinor, payload.currency),
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
        amount: normalizeMajorAmountInput(values.amountMinor, values.currency),
        currency: readString(values.currency).trim(),
        reference: optionalString(values.reference),
        memo: optionalString(values.memo),
      });
    },
  };
}

function createAdjustmentDefinition(input: {
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
      },
      {
        id: "amount",
        title: "Сумма",
        fields: [
          { kind: "amountMinor", name: "amountMinor", label: "Сумма" },
          { kind: "currency", name: "currency", label: "Валюта" },
          { kind: "textarea", name: "memo", label: "Комментарий", rows: 3 },
        ],
      },
    ],
    defaultValues() {
      return {
        occurredAt: nowDateTimeLocal(),
        counterpartyId: "",
        amountMinor: "",
        currency: "",
        reference: "",
        memo: "",
      };
    },
    fromPayload(payload) {
      return {
        occurredAt: isoToDateTimeLocal(payload.occurredAt),
        counterpartyId: readString(payload.counterpartyId),
        amountMinor: toMajorAmountInput(payload.amountMinor, payload.currency),
        currency: readString(payload.currency),
        reference: readString(payload.reference),
        memo: readString(payload.memo),
      };
    },
    toPayload(values) {
      return parseSchema(input.schema, {
        occurredAt: toOccurredAtIso(values.occurredAt),
        counterpartyId: readString(values.counterpartyId).trim(),
        amount: normalizeMajorAmountInput(values.amountMinor, values.currency),
        currency: readString(values.currency).trim(),
        reference: optionalString(values.reference),
        memo: optionalString(values.memo),
      });
    },
  };
}

function createPeriodReopenDefinition(): DocumentFormDefinition {
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

const DOCUMENT_FORM_DEFINITIONS: DocumentFormDefinition[] = [
  createTransferIntraDefinition(),
  createTransferIntercompanyDefinition(),
  createTransferResolutionDefinition(),
  createCapitalFundingDefinition(),
  createLoanLikeDefinition({
    docType: "intercompany_loan_drawdown",
    label: "Выдача межкорпоративного займа",
    schema: IntercompanyLoanDrawdownInputSchema,
  }),
  createLoanLikeDefinition({
    docType: "intercompany_loan_repayment",
    label: "Погашение межкорпоративного займа",
    schema: IntercompanyLoanRepaymentInputSchema,
  }),
  createInterestAccrualDefinition(),
  createLoanLikeDefinition({
    docType: "intercompany_interest_settlement",
    label: "Расчет по межкорпоративным процентам",
    schema: IntercompanyInterestSettlementInputSchema,
  }),
  createEquityDefinition({
    docType: "equity_contribution",
    label: "Вклад в капитал",
    schema: EquityContributionInputSchema,
  }),
  createEquityDefinition({
    docType: "equity_distribution",
    label: "Распределение капитала",
    schema: EquityDistributionInputSchema,
  }),
  createAdjustmentDefinition({
    docType: "accrual_adjustment",
    label: "Корректировка начислений",
    schema: AccrualAdjustmentInputSchema,
  }),
  createAdjustmentDefinition({
    docType: "revaluation_adjustment",
    label: "Корректировка переоценки",
    schema: RevaluationAdjustmentInputSchema,
  }),
  createAdjustmentDefinition({
    docType: "impairment_adjustment",
    label: "Корректировка обесценения",
    schema: ImpairmentAdjustmentInputSchema,
  }),
  createAdjustmentDefinition({
    docType: "closing_reclass",
    label: "Закрывающая реклассификация",
    schema: ClosingReclassInputSchema,
  }),
  createPeriodReopenDefinition(),
];

const DOCUMENT_FORM_DEFINITION_BY_TYPE = new Map(
  DOCUMENT_FORM_DEFINITIONS.map((definition) => [
    definition.docType,
    definition,
  ]),
);

export function getDocumentFormDefinition(
  docType: string,
): DocumentFormDefinition | null {
  return (
    DOCUMENT_FORM_DEFINITION_BY_TYPE.get(docType as TypedDocumentType) ?? null
  );
}

export function getDocumentFormDefinitionForRole(input: {
  docType: string;
  role: UserRole;
}): DocumentFormDefinition | null {
  const definition = getDocumentFormDefinition(input.docType);
  if (!definition) {
    return null;
  }

  if (definition.adminOnly && input.role !== "admin") {
    return null;
  }

  return definition;
}
