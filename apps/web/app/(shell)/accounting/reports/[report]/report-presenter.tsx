import { Badge } from "@multihansa/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@multihansa/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@multihansa/ui/components/table";
import { cn } from "@multihansa/ui/lib/utils";

import type { AccountingReportKey } from "@/features/accounting/lib/queries";
import { formatAmountByCurrency } from "@/lib/format";

type RowRecord = Record<string, unknown>;

type AmountTone =
  | "credit"
  | "debit"
  | "negative"
  | "neutral"
  | "positive"
  | "signed";

type ColumnKind = "amount" | "code" | "datetime" | "enum" | "text" | "uuid";

type ColumnMeta = {
  align?: "left" | "right";
  emptyLabel?: string;
  kind?: ColumnKind;
  label: string;
  tone?: AmountTone;
};

type DetailItem = {
  fieldKey?: string;
  label: string;
  value: unknown;
};

type HeaderCell = {
  className?: string;
  colSpan?: number;
  key: string;
  label: string;
  rowSpan?: number;
  separatorBefore?: boolean;
};

type ReportSection = {
  description?: string;
  emptyText?: string;
  id: string;
  rows: RowRecord[];
  title: string;
};

type ReportPresentationContext = {
  accountNo: string[];
  asOf: string;
  from: string;
  method: string;
  periodStart: string;
  to: string;
};

type OverviewCard = {
  description?: string;
  items: DetailItem[];
  title: string;
};

const BOOLEAN_LABELS = {
  false: "Нет",
  true: "Да",
} as const;

const FIELD_META: Record<string, ColumnMeta> = {
  accountKind: {
    emptyLabel: "Не указан",
    kind: "enum",
    label: "Тип счета",
  },
  accountName: {
    emptyLabel: "Без названия",
    label: "Наименование счета",
  },
  accountNo: {
    kind: "code",
    label: "Счет",
  },
  actorId: {
    emptyLabel: "Система",
    kind: "uuid",
    label: "Инициатор",
  },
  amount: {
    align: "right",
    kind: "amount",
    label: "Сумма",
    tone: "signed",
  },
  assets: {
    align: "right",
    kind: "amount",
    label: "Активы",
    tone: "neutral",
  },
  attributionMode: {
    kind: "enum",
    label: "Режим атрибуции",
  },
  available: {
    align: "right",
    kind: "amount",
    label: "Доступно",
    tone: "positive",
  },
  balance: {
    align: "right",
    kind: "amount",
    label: "Остаток",
    tone: "signed",
  },
  bookId: {
    kind: "uuid",
    label: "ID книги",
  },
  bookLabel: {
    label: "Книга",
  },
  bucket: {
    kind: "enum",
    label: "Тип результата",
  },
  channel: {
    label: "Канал",
  },
  checksum: {
    kind: "code",
    label: "Контрольная сумма",
  },
  closeDocumentId: {
    kind: "uuid",
    label: "Документ закрытия",
  },
  closingCredit: {
    align: "right",
    kind: "amount",
    label: "Исходящее сальдо, кредит",
    tone: "credit",
  },
  closingDebit: {
    align: "right",
    kind: "amount",
    label: "Исходящее сальдо, дебет",
    tone: "debit",
  },
  counterpartyId: {
    emptyLabel: "Без контрагента",
    kind: "uuid",
    label: "ID контрагента",
  },
  counterpartyName: {
    emptyLabel: "Без контрагента",
    label: "Контрагент",
  },
  createdAt: {
    kind: "datetime",
    label: "Создано",
  },
  credit: {
    align: "right",
    kind: "amount",
    label: "Кредит",
    tone: "credit",
  },
  currency: {
    kind: "code",
    label: "Валюта",
  },
  debit: {
    align: "right",
    kind: "amount",
    label: "Дебет",
    tone: "debit",
  },
  docNo: {
    kind: "code",
    label: "Номер документа",
  },
  docType: {
    label: "Тип документа",
  },
  documentId: {
    kind: "uuid",
    label: "ID документа",
  },
  equity: {
    align: "right",
    kind: "amount",
    label: "Капитал",
    tone: "neutral",
  },
  eventType: {
    kind: "enum",
    label: "Событие",
  },
  expense: {
    align: "right",
    kind: "amount",
    label: "Расход",
    tone: "negative",
  },
  feeRevenue: {
    align: "right",
    kind: "amount",
    label: "Комиссионный доход",
    tone: "positive",
  },
  generatedAt: {
    kind: "datetime",
    label: "Сформирован",
  },
  hasUnattributedData: {
    kind: "enum",
    label: "Есть неатрибутированные данные",
  },
  id: {
    kind: "uuid",
    label: "ID",
  },
  imbalance: {
    align: "right",
    kind: "amount",
    label: "Дисбаланс",
    tone: "signed",
  },
  liabilities: {
    align: "right",
    kind: "amount",
    label: "Обязательства",
    tone: "neutral",
  },
  ledgerBalance: {
    align: "right",
    kind: "amount",
    label: "Баланс книги",
    tone: "signed",
  },
  lineCode: {
    kind: "code",
    label: "Код строки",
  },
  lineLabel: {
    label: "Строка",
  },
  lineNo: {
    align: "right",
    label: "Строка",
  },
  method: {
    kind: "enum",
    label: "Метод",
  },
  net: {
    align: "right",
    kind: "amount",
    label: "Итого",
    tone: "signed",
  },
  netCashFlow: {
    align: "right",
    kind: "amount",
    label: "Чистый денежный поток",
    tone: "signed",
  },
  occurredAt: {
    kind: "datetime",
    label: "Дата документа",
  },
  openingCredit: {
    align: "right",
    kind: "amount",
    label: "Входящее сальдо, кредит",
    tone: "credit",
  },
  openingDebit: {
    align: "right",
    kind: "amount",
    label: "Входящее сальдо, дебет",
    tone: "debit",
  },
  operationId: {
    kind: "uuid",
    label: "Операция",
  },
  pending: {
    align: "right",
    kind: "amount",
    label: "В обработке",
    tone: "neutral",
  },
  periodCredit: {
    align: "right",
    kind: "amount",
    label: "Обороты, кредит",
    tone: "credit",
  },
  periodDebit: {
    align: "right",
    kind: "amount",
    label: "Обороты, дебет",
    tone: "debit",
  },
  periodEnd: {
    kind: "datetime",
    label: "Конец периода",
  },
  periodStart: {
    kind: "datetime",
    label: "Начало периода",
  },
  postingDate: {
    kind: "datetime",
    label: "Дата проводки",
  },
  postingCode: {
    kind: "code",
    label: "Код проводки",
  },
  product: {
    label: "Продукт",
  },
  providerFeeExpense: {
    align: "right",
    kind: "amount",
    label: "Расход провайдера",
    tone: "negative",
  },
  realizedNet: {
    align: "right",
    kind: "amount",
    label: "Реализованный результат",
    tone: "signed",
  },
  reopenDocumentId: {
    emptyLabel: "Не переоткрывался",
    kind: "uuid",
    label: "Документ переоткрытия",
  },
  requestedBookIdsCount: {
    align: "right",
    label: "Книг в запросе",
  },
  requestedCounterpartyIdsCount: {
    align: "right",
    label: "Контрагентов в запросе",
  },
  requestedGroupIdsCount: {
    align: "right",
    label: "Групп в запросе",
  },
  reserved: {
    align: "right",
    kind: "amount",
    label: "Зарезервировано",
    tone: "neutral",
  },
  resolvedCounterpartyIdsCount: {
    align: "right",
    label: "Контрагентов в выборке",
  },
  revenue: {
    align: "right",
    kind: "amount",
    label: "Доход",
    tone: "positive",
  },
  revision: {
    align: "right",
    label: "Ревизия",
  },
  runningBalance: {
    align: "right",
    kind: "amount",
    label: "Нарастающий остаток",
    tone: "signed",
  },
  scopeType: {
    kind: "enum",
    label: "Область",
  },
  section: {
    kind: "enum",
    label: "Раздел",
  },
  spreadRevenue: {
    align: "right",
    kind: "amount",
    label: "Спред",
    tone: "positive",
  },
  state: {
    kind: "enum",
    label: "Состояние",
  },
  title: {
    label: "Описание",
  },
  totalNet: {
    align: "right",
    kind: "amount",
    label: "Совокупный результат",
    tone: "signed",
  },
  unrealizedNet: {
    align: "right",
    kind: "amount",
    label: "Нереализованный результат",
    tone: "signed",
  },
};

const ENUM_LABELS: Record<string, Record<string, string>> = {
  accountKind: {
    asset: "Актив",
    equity: "Капитал",
    expense: "Расход",
    liability: "Обязательство",
    revenue: "Доход",
  },
  attributionMode: {
    analytic_counterparty: "Аналитика контрагента",
    book_org: "Организация книги",
  },
  bucket: {
    realized: "Реализованный",
    unrealized: "Нереализованный",
  },
  eventType: {
    close: "Закрытие",
    create: "Создание",
    policy_denied: "Отклонено политикой",
    post: "Проведение",
    reopen: "Переоткрытие",
  },
  hasUnattributedData: BOOLEAN_LABELS,
  method: {
    direct: "Прямой",
    indirect: "Косвенный",
  },
  scopeType: {
    all: "Все",
    book: "Книга",
    counterparty: "Контрагент",
    group: "Группа",
  },
  section: {
    assets: "Активы",
    equity: "Капитал",
    expense: "Расходы",
    financing: "Финансовая деятельность",
    indirect: "Косвенный метод",
    investing: "Инвестиционная деятельность",
    liabilities: "Обязательства",
    operating: "Операционная деятельность",
    revenue: "Доходы",
  },
  state: {
    closed: "Закрыт",
    superseded: "Заменен новой версией",
  },
};

const SECTION_COLUMNS: Record<string, string[]> = {
  "balance-sheet:checks": [
    "currency",
    "assets",
    "liabilities",
    "equity",
    "imbalance",
  ],
  "balance-sheet:data": [
    "section",
    "lineCode",
    "lineLabel",
    "currency",
    "amount",
  ],
  "cash-flow:data": ["section", "lineCode", "lineLabel", "currency", "amount"],
  "cash-flow:summaryByCurrency": ["currency", "netCashFlow"],
  "close-package:auditEvents": ["createdAt", "eventType", "actorId", "id"],
  "close-package:adjustments": [
    "occurredAt",
    "docType",
    "docNo",
    "title",
    "documentId",
  ],
  "close-package:cashFlowSummaryByCurrency": ["currency", "netCashFlow"],
  "close-package:incomeStatementSummaryByCurrency": [
    "currency",
    "revenue",
    "expense",
    "net",
  ],
  "close-package:trialBalanceSummaryByCurrency": [
    "currency",
    "openingDebit",
    "openingCredit",
    "periodDebit",
    "periodCredit",
    "closingDebit",
    "closingCredit",
  ],
  "fee-revenue:data": [
    "product",
    "channel",
    "counterpartyName",
    "currency",
    "feeRevenue",
    "spreadRevenue",
    "providerFeeExpense",
    "net",
    "counterpartyId",
  ],
  "fee-revenue:summaryByCurrency": [
    "currency",
    "feeRevenue",
    "spreadRevenue",
    "providerFeeExpense",
    "net",
  ],
  "fx-revaluation:data": ["bucket", "currency", "revenue", "expense", "net"],
  "fx-revaluation:summaryByCurrency": [
    "currency",
    "realizedNet",
    "unrealizedNet",
    "totalNet",
  ],
  "general-ledger:closingBalances": ["accountNo", "currency", "balance"],
  "general-ledger:data": [
    "postingDate",
    "lineNo",
    "accountNo",
    "bookLabel",
    "currency",
    "debit",
    "credit",
    "runningBalance",
    "postingCode",
    "counterpartyId",
    "operationId",
  ],
  "general-ledger:openingBalances": ["accountNo", "currency", "balance"],
  "income-statement:data": [
    "section",
    "lineCode",
    "lineLabel",
    "currency",
    "amount",
  ],
  "income-statement:summaryByCurrency": [
    "currency",
    "revenue",
    "expense",
    "net",
  ],
  "liquidity:data": [
    "bookLabel",
    "counterpartyName",
    "currency",
    "ledgerBalance",
    "available",
    "reserved",
    "pending",
    "bookId",
    "counterpartyId",
  ],
  "trial-balance:data": [
    "accountNo",
    "accountName",
    "accountKind",
    "currency",
    "openingDebit",
    "openingCredit",
    "periodDebit",
    "periodCredit",
    "closingDebit",
    "closingCredit",
  ],
  "trial-balance:summaryByCurrency": [
    "currency",
    "openingDebit",
    "openingCredit",
    "periodDebit",
    "periodCredit",
    "closingDebit",
    "closingCredit",
  ],
};

const utcDateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

const SALDO_HEADER_GROUPS = [
  {
    keys: ["openingDebit", "openingCredit"],
    label: "Входящее сальдо",
  },
  {
    keys: ["periodDebit", "periodCredit"],
    label: "Обороты",
  },
  {
    keys: ["closingDebit", "closingCredit"],
    label: "Исходящее сальдо",
  },
] as const;

function asObjectRows(value: unknown): RowRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is RowRecord => {
    return Boolean(item) && typeof item === "object" && !Array.isArray(item);
  });
}

function formatCount(value: number) {
  return value.toLocaleString("ru-RU");
}

function formatUtcDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return utcDateTimeFormatter.format(date);
}

function humanizeKey(value: string) {
  const normalized = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();

  if (normalized.length === 0) {
    return value;
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function isZeroAmount(value: unknown) {
  return /^[-+]?0+(?:[.,]0+)?$/.test(String(value).trim());
}

function normalizeNumericString(value: unknown) {
  const normalized = String(value).trim().replace(",", ".");
  if (!/^[-+]?\d+(?:\.\d+)?$/.test(normalized)) {
    return null;
  }

  return normalized;
}

function formatAmountText(
  value: unknown,
  currency: string | null,
  tone: AmountTone,
) {
  const normalized = normalizeNumericString(value);
  if (!normalized) {
    return String(value);
  }

  const absolute = normalized.replace(/^[-+]/, "");
  const isNegative = normalized.startsWith("-");
  const isPositive = !isNegative && !isZeroAmount(normalized);

  switch (tone) {
    case "debit":
    case "negative":
      return isZeroAmount(normalized)
        ? formatAmountByCurrency(0, currency)
        : `-${formatAmountByCurrency(absolute, currency)}`;
    case "credit":
    case "positive":
      return isZeroAmount(normalized)
        ? formatAmountByCurrency(0, currency)
        : `+${formatAmountByCurrency(absolute, currency)}`;
    case "signed":
      if (isZeroAmount(normalized)) {
        return formatAmountByCurrency(0, currency);
      }

      return `${isNegative ? "-" : isPositive ? "+" : ""}${formatAmountByCurrency(
        absolute,
        currency,
      )}`;
    case "neutral":
      return formatAmountByCurrency(normalized, currency);
  }
}

function getAmountClassName(value: unknown, tone: AmountTone) {
  if (isZeroAmount(value)) {
    return "text-muted-foreground";
  }

  switch (tone) {
    case "credit":
    case "positive":
      return "text-green-600 dark:text-green-400";
    case "debit":
    case "negative":
      return "text-red-600 dark:text-red-400";
    case "signed":
      return String(value).trim().startsWith("-")
        ? "text-red-600 dark:text-red-400"
        : "text-green-600 dark:text-green-400";
    case "neutral":
      return "text-foreground";
  }
}

function getEnumLabel(key: string, value: string) {
  const mapped = ENUM_LABELS[key]?.[value];
  if (mapped) {
    return mapped;
  }

  return humanizeKey(value);
}

function getEnumBadgeVariant(key: string, value: string) {
  if (key === "bucket") {
    return value === "realized" ? "success" : "secondary";
  }

  if (key === "state") {
    return value === "closed" ? "success" : "secondary";
  }

  if (key === "hasUnattributedData") {
    return value === "true" ? "secondary" : "outline";
  }

  return "outline";
}

function shortenMiddle(value: string, head = 8, tail = 4) {
  if (value.length <= head + tail + 1) {
    return value;
  }

  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

function getCurrency(row: RowRecord) {
  return typeof row.currency === "string" ? row.currency : null;
}

function getColumnMeta(key: string): ColumnMeta {
  return FIELD_META[key] ?? { label: humanizeKey(key) };
}

function renderValue(fieldKey: string, value: unknown, row: RowRecord) {
  const meta = getColumnMeta(fieldKey);

  if (value === null || value === undefined || value === "") {
    return (
      <span className="text-muted-foreground">{meta.emptyLabel ?? "—"}</span>
    );
  }

  if (meta.kind === "amount") {
    const tone = meta.tone ?? "neutral";
    return (
      <span
        className={cn(
          "font-mono text-sm font-semibold tabular-nums",
          getAmountClassName(value, tone),
        )}
      >
        {formatAmountText(value, getCurrency(row), tone)}
      </span>
    );
  }

  if (meta.kind === "datetime" && typeof value === "string") {
    return <span>{formatUtcDateTime(value)}</span>;
  }

  if (meta.kind === "uuid" && typeof value === "string") {
    return (
      <span
        className="inline-block max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs text-muted-foreground"
        title={value}
      >
        {shortenMiddle(value)}
      </span>
    );
  }

  if (meta.kind === "code" && typeof value === "string") {
    return (
      <span
        className="inline-block max-w-full whitespace-normal break-all font-mono text-sm"
        title={value}
      >
        {fieldKey === "checksum" ? shortenMiddle(value, 10, 6) : value}
      </span>
    );
  }

  if (meta.kind === "enum" && typeof value === "string") {
    return (
      <Badge variant={getEnumBadgeVariant(fieldKey, value)}>
        {getEnumLabel(fieldKey, value)}
      </Badge>
    );
  }

  if (typeof value === "boolean") {
    return (
      <Badge variant={value ? "success" : "outline"}>
        {BOOLEAN_LABELS[String(value) as keyof typeof BOOLEAN_LABELS]}
      </Badge>
    );
  }

  if (typeof value === "number") {
    return (
      <span className={cn(meta.align === "right" && "font-mono tabular-nums")}>
        {formatCount(value)}
      </span>
    );
  }

  if (Array.isArray(value)) {
    return (
      <span className="text-muted-foreground whitespace-normal break-all text-xs">
        {value.join(", ")}
      </span>
    );
  }

  if (typeof value === "object") {
    return (
      <span className="text-muted-foreground whitespace-normal break-all text-xs">
        {JSON.stringify(value)}
      </span>
    );
  }

  return <span className="whitespace-normal break-words">{String(value)}</span>;
}

function getColumnKeys(report: AccountingReportKey, section: ReportSection) {
  const rowKeys =
    section.rows.length === 0 ? [] : Object.keys(section.rows[0]!);
  const configured = SECTION_COLUMNS[`${report}:${section.id}`] ?? [];

  if (configured.length === 0) {
    return rowKeys;
  }

  return [
    ...configured.filter((key) => rowKeys.includes(key)),
    ...rowKeys.filter((key) => !configured.includes(key)),
  ];
}

function getHeadClassName(key: string) {
  const meta = getColumnMeta(key);

  return cn(
    "whitespace-normal break-words align-top leading-tight",
    meta.align === "right" && "text-right",
  );
}

function getCellClassName(key: string) {
  const meta = getColumnMeta(key);

  return cn(
    "align-top",
    meta.align === "right"
      ? "whitespace-nowrap text-right"
      : "whitespace-normal break-words",
  );
}

function getColumnSeparatorClass(separatorBefore?: boolean) {
  return separatorBefore ? "border-l border-border/60" : undefined;
}

function getHeaderRows(columnKeys: string[]) {
  const saldoKeys = new Set<string>(
    SALDO_HEADER_GROUPS.flatMap((group) => group.keys),
  );
  const hasSaldoHeader = SALDO_HEADER_GROUPS.every((group) => {
    return group.keys.every((key) => columnKeys.includes(key));
  });

  if (!hasSaldoHeader) {
    return [
      columnKeys.map<HeaderCell>((key, index) => ({
        className: cn(
          getHeadClassName(key),
          getColumnSeparatorClass(index > 0),
        ),
        key,
        label: getColumnMeta(key).label,
        separatorBefore: index > 0,
      })),
    ];
  }

  const leadingKeys = columnKeys.filter((key) => !saldoKeys.has(key));

  const topRow: HeaderCell[] = [
    ...leadingKeys.map((key, index) => ({
      className: cn(getHeadClassName(key), getColumnSeparatorClass(index > 0)),
      key,
      label: getColumnMeta(key).label,
      rowSpan: 2,
      separatorBefore: index > 0,
    })),
    ...SALDO_HEADER_GROUPS.map((group, index) => ({
      className: cn(
        "text-center align-middle",
        getColumnSeparatorClass(leadingKeys.length + index * 2 > 0),
      ),
      colSpan: group.keys.length,
      key: group.label,
      label: group.label,
      separatorBefore: leadingKeys.length + index * 2 > 0,
    })),
  ];

  const bottomRow: HeaderCell[] = SALDO_HEADER_GROUPS.flatMap(
    (group, groupIndex) =>
      group.keys.map((key, keyIndex) => {
        const absoluteIndex =
          leadingKeys.length + groupIndex * group.keys.length + keyIndex;

        return {
          className: cn(
            getHeadClassName(key),
            getColumnSeparatorClass(absoluteIndex > 0),
          ),
          key,
          label: key.toLowerCase().includes("debit") ? "Дебет" : "Кредит",
          separatorBefore: absoluteIndex > 0,
        };
      }),
  );

  return [topRow, bottomRow];
}

function getDataSectionMeta(
  report: AccountingReportKey,
  context: ReportPresentationContext,
) {
  switch (report) {
    case "trial-balance":
      return {
        description: `Период: ${formatUtcDateTime(context.from)} - ${formatUtcDateTime(context.to)} (UTC).`,
        emptyText: "За выбранный период данных нет.",
        title: "Оборотно-сальдовая ведомость",
      };
    case "general-ledger":
      return {
        description: `Период: ${formatUtcDateTime(context.from)} - ${formatUtcDateTime(context.to)} (UTC).`,
        emptyText: "За выбранный период проводки не найдены.",
        title: "Проводки по счетам",
      };
    case "balance-sheet":
      return {
        description: `Срез на ${formatUtcDateTime(context.asOf)} (UTC).`,
        emptyText: "Данные для баланса отсутствуют.",
        title: "Строки бухгалтерского баланса",
      };
    case "income-statement":
      return {
        description: `Период: ${formatUtcDateTime(context.from)} - ${formatUtcDateTime(context.to)} (UTC).`,
        emptyText: "Данные по доходам и расходам отсутствуют.",
        title: "Строки ОФР",
      };
    case "cash-flow":
      return {
        description: `Период: ${formatUtcDateTime(context.from)} - ${formatUtcDateTime(context.to)} (UTC).`,
        emptyText: "Движение денежных средств за период отсутствует.",
        title: "Строки ОДДС",
      };
    case "liquidity":
      return {
        description: `Срез на ${formatUtcDateTime(context.asOf)} (UTC).`,
        emptyText: "Позиции ликвидности отсутствуют.",
        title: "Позиции ликвидности",
      };
    case "fx-revaluation":
      return {
        description: `Период: ${formatUtcDateTime(context.from)} - ${formatUtcDateTime(context.to)} (UTC).`,
        emptyText: "Курсовые разницы за период отсутствуют.",
        title: "Строки переоценки",
      };
    case "fee-revenue":
      return {
        description: `Период: ${formatUtcDateTime(context.from)} - ${formatUtcDateTime(context.to)} (UTC).`,
        emptyText: "Доходы и расходы по комиссиям отсутствуют.",
        title: "Доходы по комиссиям",
      };
    case "close-package":
      return null;
  }
}

function getSectionRows(payload: RowRecord | null, key: string) {
  return asObjectRows(payload?.[key]);
}

function createSection(
  id: string,
  title: string,
  rows: RowRecord[],
  description?: string,
  emptyText?: string,
): ReportSection {
  return { description, emptyText, id, rows, title };
}

function getScopeMeta(payload: RowRecord | null) {
  const scopeMeta =
    payload &&
    typeof payload.scopeMeta === "object" &&
    payload.scopeMeta !== null
      ? (payload.scopeMeta as RowRecord)
      : null;

  return scopeMeta;
}

function getStringArrayLength(record: RowRecord, key: string) {
  const value = record[key];
  return Array.isArray(value) ? value.length : 0;
}

function getStringValue(record: RowRecord, key: string) {
  return typeof record[key] === "string" ? record[key] : null;
}

function getNumberValue(record: RowRecord, key: string) {
  return typeof record[key] === "number" ? record[key] : null;
}

export function buildReportOverviewCards(
  report: AccountingReportKey,
  payload: RowRecord | null,
  context: ReportPresentationContext,
): OverviewCard[] {
  const cards: OverviewCard[] = [];

  switch (report) {
    case "trial-balance":
    case "general-ledger":
    case "income-statement":
    case "fx-revaluation":
    case "fee-revenue":
      cards.push({
        description: "Параметры, с которыми сформирован отчет.",
        items: [
          {
            fieldKey: "periodStart",
            label: "Начало периода",
            value: context.from,
          },
          {
            fieldKey: "periodEnd",
            label: "Конец периода",
            value: context.to,
          },
        ],
        title: "Параметры отчета",
      });
      break;
    case "cash-flow":
      cards.push({
        description: "Параметры, с которыми сформирован отчет.",
        items: [
          {
            fieldKey: "periodStart",
            label: "Начало периода",
            value: context.from,
          },
          {
            fieldKey: "periodEnd",
            label: "Конец периода",
            value: context.to,
          },
          {
            fieldKey: "method",
            label: "Метод",
            value: context.method,
          },
        ],
        title: "Параметры отчета",
      });
      break;
    case "balance-sheet":
    case "liquidity":
      cards.push({
        description: "Параметры, с которыми сформирован отчет.",
        items: [
          {
            fieldKey: "generatedAt",
            label: "Дата среза",
            value: context.asOf,
          },
        ],
        title: "Параметры отчета",
      });
      break;
    case "close-package":
      cards.push({
        description: "Параметры, с которыми сформирован пакет закрытия.",
        items: [
          {
            fieldKey: "periodStart",
            label: "Начало периода",
            value: context.periodStart,
          },
        ],
        title: "Параметры отчета",
      });
      break;
  }

  if (report === "general-ledger" && context.accountNo.length > 0) {
    const lastCard = cards.at(-1);
    if (lastCard) {
      lastCard.items.push({
        label: "Счета",
        value: context.accountNo.join(", "),
      });
    }
  }

  const scopeMeta = getScopeMeta(payload);
  if (scopeMeta) {
    cards.push({
      description:
        "Как была разрешена область данных после применения фильтров.",
      items: [
        {
          fieldKey: "scopeType",
          label: "Область",
          value: getStringValue(scopeMeta, "scopeType"),
        },
        {
          fieldKey: "attributionMode",
          label: "Атрибуция",
          value: getStringValue(scopeMeta, "attributionMode"),
        },
        {
          fieldKey: "resolvedCounterpartyIdsCount",
          label: "Контрагентов в выборке",
          value: getNumberValue(scopeMeta, "resolvedCounterpartyIdsCount") ?? 0,
        },
        {
          fieldKey: "requestedCounterpartyIdsCount",
          label: "Контрагентов в запросе",
          value: getStringArrayLength(scopeMeta, "requestedCounterpartyIds"),
        },
        {
          fieldKey: "requestedGroupIdsCount",
          label: "Групп в запросе",
          value: getStringArrayLength(scopeMeta, "requestedGroupIds"),
        },
        {
          fieldKey: "requestedBookIdsCount",
          label: "Книг в запросе",
          value: getStringArrayLength(scopeMeta, "requestedBookIds"),
        },
        {
          fieldKey: "hasUnattributedData",
          label: "Есть неатрибутированные данные",
          value: String(Boolean(scopeMeta.hasUnattributedData)),
        },
      ],
      title: "Область данных",
    });
  }

  if (report === "close-package" && payload) {
    cards.push({
      description: "Ключевые реквизиты сформированного пакета закрытия.",
      items: [
        { fieldKey: "id", label: "ID пакета", value: payload.id },
        {
          fieldKey: "counterpartyId",
          label: "Контрагент",
          value: payload.counterpartyId,
        },
        {
          fieldKey: "periodStart",
          label: "Начало периода",
          value: payload.periodStart,
        },
        {
          fieldKey: "periodEnd",
          label: "Конец периода",
          value: payload.periodEnd,
        },
        { fieldKey: "revision", label: "Ревизия", value: payload.revision },
        { fieldKey: "state", label: "Состояние", value: payload.state },
        {
          fieldKey: "generatedAt",
          label: "Сформирован",
          value: payload.generatedAt,
        },
        {
          fieldKey: "checksum",
          label: "Контрольная сумма",
          value: payload.checksum,
        },
        {
          fieldKey: "closeDocumentId",
          label: "Документ закрытия",
          value: payload.closeDocumentId,
        },
        {
          fieldKey: "reopenDocumentId",
          label: "Документ переоткрытия",
          value: payload.reopenDocumentId,
        },
      ],
      title: "Сводка пакета закрытия",
    });
  }

  return cards;
}

export function buildReportSections(
  report: AccountingReportKey,
  payload: RowRecord | null,
  context: ReportPresentationContext,
): ReportSection[] {
  const sections: ReportSection[] = [];
  const dataMeta = getDataSectionMeta(report, context);

  if (dataMeta) {
    sections.push(
      createSection(
        "data",
        dataMeta.title,
        getSectionRows(payload, "data"),
        dataMeta.description,
        dataMeta.emptyText,
      ),
    );
  }

  switch (report) {
    case "trial-balance":
      sections.push(
        createSection(
          "summaryByCurrency",
          "Итоги по валютам",
          getSectionRows(payload, "summaryByCurrency"),
          "Агрегированные остатки и обороты по каждой валюте.",
        ),
      );
      break;
    case "general-ledger":
      sections.push(
        createSection(
          "openingBalances",
          "Входящие остатки",
          getSectionRows(payload, "openingBalances"),
          `Остатки на начало периода ${formatUtcDateTime(context.from)} (UTC).`,
        ),
      );
      sections.push(
        createSection(
          "closingBalances",
          "Исходящие остатки",
          getSectionRows(payload, "closingBalances"),
          `Остатки на конец периода ${formatUtcDateTime(context.to)} (UTC).`,
        ),
      );
      break;
    case "balance-sheet":
      sections.push(
        createSection(
          "checks",
          "Контрольные проверки",
          getSectionRows(payload, "checks"),
          "Проверка равенства активов сумме обязательств и капитала.",
        ),
      );
      break;
    case "income-statement":
      sections.push(
        createSection(
          "summaryByCurrency",
          "Итоги по валютам",
          getSectionRows(payload, "summaryByCurrency"),
          "Сводка по доходам, расходам и чистому результату.",
        ),
      );
      break;
    case "cash-flow":
      sections.push(
        createSection(
          "summaryByCurrency",
          "Итоги по валютам",
          getSectionRows(payload, "summaryByCurrency"),
          "Сводка по чистому денежному потоку.",
        ),
      );
      break;
    case "liquidity":
      break;
    case "fx-revaluation":
      sections.push(
        createSection(
          "summaryByCurrency",
          "Итоги по валютам",
          getSectionRows(payload, "summaryByCurrency"),
          "Сводка по реализованному и нереализованному результату.",
        ),
      );
      break;
    case "fee-revenue":
      sections.push(
        createSection(
          "summaryByCurrency",
          "Итоги по валютам",
          getSectionRows(payload, "summaryByCurrency"),
          "Сводка по комиссионным доходам и расходам.",
        ),
      );
      break;
    case "close-package":
      sections.push(
        createSection(
          "trialBalanceSummaryByCurrency",
          "Пакет закрытия: итоги ОСВ",
          getSectionRows(payload, "trialBalanceSummaryByCurrency"),
          "Итоги оборотно-сальдовой ведомости, зафиксированные в пакете закрытия.",
        ),
      );
      sections.push(
        createSection(
          "incomeStatementSummaryByCurrency",
          "Пакет закрытия: итоги ОФР",
          getSectionRows(payload, "incomeStatementSummaryByCurrency"),
          "Итоги по отчету о финансовых результатах.",
        ),
      );
      sections.push(
        createSection(
          "cashFlowSummaryByCurrency",
          "Пакет закрытия: итоги ОДДС",
          getSectionRows(payload, "cashFlowSummaryByCurrency"),
          "Итоги по отчету о движении денежных средств.",
        ),
      );
      sections.push(
        createSection(
          "adjustments",
          "Пакет закрытия: корректировки",
          getSectionRows(payload, "adjustments"),
          "Документы и корректировки, вошедшие в пакет закрытия.",
        ),
      );
      sections.push(
        createSection(
          "auditEvents",
          "Пакет закрытия: события аудита",
          getSectionRows(payload, "auditEvents"),
          "События аудита, относящиеся к закрытию периода.",
        ),
      );
      break;
  }

  return sections.filter((section) => {
    return section.id === "data" || section.rows.length > 0;
  });
}

function DetailsCard({ card }: { card: OverviewCard }) {
  return (
    <Card className="min-w-0 rounded-sm">
      <CardHeader className="border-b">
        <CardTitle className="text-base">{card.title}</CardTitle>
        {card.description ? (
          <CardDescription>{card.description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="grid min-w-0 gap-3 pt-4 sm:grid-cols-2">
        {card.items.map((item) => (
          <div
            key={`${card.title}:${item.label}`}
            className="min-w-0 rounded-md border p-3"
          >
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.14em]">
              {item.label}
            </p>
            <div className="mt-2">
              {renderValue(item.fieldKey ?? item.label, item.value, {})}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function ReportOverviewCards({ cards }: { cards: OverviewCard[] }) {
  if (cards.length === 0) {
    return null;
  }

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      {cards.map((card) => (
        <DetailsCard key={card.title} card={card} />
      ))}
    </div>
  );
}

export function ReportSectionTable({
  report,
  section,
}: {
  report: AccountingReportKey;
  section: ReportSection;
}) {
  const columnKeys = getColumnKeys(report, section);
  const headerRows = getHeaderRows(columnKeys);

  return (
    <Card className="min-w-0 rounded-sm">
      <CardHeader className="border-b">
        <CardTitle className="text-base">{section.title}</CardTitle>
        {section.description ? (
          <CardDescription>{section.description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="min-w-0 pt-4">
        <Table className="table-auto">
          <TableHeader>
            {headerRows.map((headerRow, index) => (
              <TableRow key={`${section.id}:header:${index}`}>
                {headerRow.map((cell) => (
                  <TableHead
                    key={cell.key}
                    className={cell.className}
                    colSpan={cell.colSpan}
                    rowSpan={cell.rowSpan}
                  >
                    {cell.label}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {section.rows.length === 0 ? (
              <TableRow>
                <TableCell
                  className="text-muted-foreground h-16 text-center"
                  colSpan={Math.max(columnKeys.length, 1)}
                >
                  {section.emptyText ?? "Данные отсутствуют"}
                </TableCell>
              </TableRow>
            ) : (
              section.rows.map((row, rowIndex) => (
                <TableRow key={`${section.id}:${rowIndex}`}>
                  {columnKeys.map((key) => (
                    <TableCell
                      key={key}
                      className={cn(
                        getCellClassName(key),
                        getColumnSeparatorClass(columnKeys.indexOf(key) > 0),
                      )}
                    >
                      {renderValue(key, row[key], row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
