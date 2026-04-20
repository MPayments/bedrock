"use client";

import { ColumnDef } from "@tanstack/react-table";
import { formatCompactId } from "@bedrock/shared/core/uuid";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Avatar, AvatarFallback } from "@bedrock/sdk-ui/components/avatar";
import { DataTableColumnHeader } from "@bedrock/sdk-tables-ui/components/data-table-column-header";
import type { Option } from "@bedrock/sdk-tables-ui/lib/types";
import type {
  DealsRow,
  DealStatus,
  CurrencyCode,
} from "@/lib/hooks/useDealsTable";
import { formatCurrency, formatDate } from "@/lib/utils/currency";

export const CURRENCY_OPTIONS: Option[] = [
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
  { value: "RUB", label: "RUB" },
  { value: "CNY", label: "CNY" },
  { value: "TRY", label: "TRY" },
  { value: "AED", label: "AED" },
];

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "success"
  | "warning"
  | "outline"
  | "ghost";

const STATUS_DISPLAY: Record<
  DealStatus,
  { label: string; variant: BadgeVariant }
> = {
  draft: { label: "Черновик", variant: "secondary" },
  submitted: { label: "Отправлена", variant: "outline" },
  rejected: { label: "Отклонена", variant: "destructive" },
  preparing_documents: { label: "Подготовка документов", variant: "secondary" },
  awaiting_funds: { label: "Ожидание средств", variant: "warning" },
  awaiting_payment: { label: "Ожидание оплаты", variant: "warning" },
  closing_documents: { label: "Закрывающие документы", variant: "secondary" },
  done: { label: "Завершена", variant: "success" },
  cancelled: { label: "Отменена", variant: "destructive" },
};

export const STATUS_OPTIONS: Option[] = Object.entries(STATUS_DISPLAY).map(
  ([value, { label }]) => ({ value, label }),
);

export interface DealsColumnsOptions {
  isAdmin: boolean;
}

function initials(name: string | null | undefined): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  const second = parts[1];
  if (!first) return "—";
  if (!second) return first.slice(0, 2).toUpperCase();
  return ((first[0] ?? "") + (second[0] ?? "")).toUpperCase() || "—";
}

function formatSignedCurrency(
  value: number | null | undefined,
  currency: string | null | undefined,
): { text: string; tone: "pos" | "neg" | "zero" | "unknown" } {
  if (value == null || !Number.isFinite(value)) {
    return { text: "—", tone: "unknown" };
  }
  const tone = value > 0 ? "pos" : value < 0 ? "neg" : "zero";
  const formatted = formatCurrency(Math.abs(value), currency ?? undefined);
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return { text: `${sign}${formatted}`, tone };
}

/**
 * Создаёт колонки для таблицы сделок.
 * Порядок визуальных колонок по референс-дизайну Bedrock Finance:
 *   1. ID | 2. Клиент → Бенефициар | 3. Сумма | 4. Комиссия |
 *   5. Маржа | 6. Этап | 7. Срок | 8. Владелец
 * Остальные — legacy, скрытые по умолчанию, но доступные через ViewOptions
 * и нужные для фильтров / сортировок.
 */
export function createDealsColumns(): ColumnDef<DealsRow, unknown>[] {
  const columns: ColumnDef<DealsRow, unknown>[] = [
    // 1. ID
    {
      accessorKey: "id",
      meta: { label: "ID" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="ID" />
      ),
      enableSorting: true,
      size: 100,
      cell: ({ getValue }) => (
        <span className="num text-muted-foreground">
          #{formatCompactId(getValue<string>())}
        </span>
      ),
    },
    // 2. Клиент → Бенефициар (+ corridor)
    {
      accessorKey: "client",
      meta: { label: "Клиент → Бенефициар" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Клиент → Бенефициар" />
      ),
      enableSorting: true,
      cell: ({ row }) => {
        const client = row.original.client || "—";
        const currency = row.original.currency;
        const baseCurrency = row.original.baseCurrencyCode;
        const showCorridor = Boolean(
          currency && baseCurrency && currency !== baseCurrency,
        );
        return (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-medium">{client}</span>
            {showCorridor ? (
              <span className="num truncate text-[12px] text-muted-foreground">
                {currency} → {baseCurrency}
              </span>
            ) : null}
          </div>
        );
      },
    },
    // 3. Сумма (Gross, source currency)
    {
      id: "amount",
      accessorKey: "amount",
      meta: { label: "Сумма" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Сумма" />
      ),
      enableSorting: true,
      size: 140,
      cell: ({ row }) => (
        <div className="num text-right">
          {formatCurrency(row.original.amount, row.original.currency)}
        </div>
      ),
    },
    // 4. Комиссия (absolute = amount * fee% / 100, in source currency)
    {
      id: "feeAbsolute",
      accessorFn: (row) => (row.amount * (row.feePercentage ?? 0)) / 100,
      meta: { label: "Комиссия" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Комиссия" />
      ),
      enableSorting: false,
      size: 140,
      cell: ({ row }) => {
        const fee = row.original.feePercentage;
        if (!Number.isFinite(fee) || fee === 0) {
          return (
            <div className="num text-right text-muted-foreground">—</div>
          );
        }
        const feeAbs = (row.original.amount * fee) / 100;
        return (
          <div className="num text-right">
            {formatCurrency(feeAbs, row.original.currency)}
          </div>
        );
      },
    },
    // 5. Маржа (net margin, base currency, signed colored)
    {
      id: "netMargin",
      accessorKey: "netMarginInBase",
      meta: { label: "Маржа" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Маржа" />
      ),
      enableSorting: false,
      size: 140,
      cell: ({ row }) => {
        const value = row.original.netMarginInBase;
        const baseCurrency = row.original.baseCurrencyCode;
        const { text, tone } = formatSignedCurrency(value, baseCurrency);
        const toneClass =
          tone === "pos"
            ? "text-success"
            : tone === "neg"
              ? "text-destructive"
              : "text-muted-foreground";
        return <div className={`num text-right ${toneClass}`}>{text}</div>;
      },
    },
    // 6. Этап (status)
    {
      accessorKey: "status",
      meta: { label: "Этап" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Этап" />
      ),
      enableSorting: false,
      cell: ({ getValue }) => {
        const status = getValue<DealStatus>();
        const display = STATUS_DISPLAY[status];
        return (
          <Badge variant={display.variant} className="badge-dot">
            {display.label}
          </Badge>
        );
      },
      filterFn: (row, id, filterValues) => {
        const v = row.getValue<DealStatus>(id);
        return Array.isArray(filterValues) ? filterValues.includes(v) : true;
      },
    },
    // 7. Срок (closedAt if set, else updatedAt — proxy for reference's "Due")
    {
      id: "dueDate",
      accessorFn: (row) => row.closedAt ?? row.updatedAt,
      meta: { label: "Срок" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Срок" />
      ),
      enableSorting: false,
      size: 90,
      cell: ({ row }) => {
        const value = row.original.closedAt ?? row.original.updatedAt;
        return (
          <span className="num text-[12px] text-muted-foreground">
            {value ? formatDate(value) : "—"}
          </span>
        );
      },
    },
    // 8. Владелец (avatar)
    {
      id: "ownerAvatar",
      accessorKey: "agentName",
      meta: { label: "Владелец" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Владелец" />
      ),
      enableSorting: false,
      size: 60,
      cell: ({ row }) => (
        <Avatar size="sm" className="bg-muted">
          <AvatarFallback className="bg-muted text-foreground/70 text-[10px] font-semibold">
            {initials(row.original.agentName)}
          </AvatarFallback>
        </Avatar>
      ),
    },

    // ——— Legacy columns (скрыты по умолчанию, доступны через ViewOptions) ———
    {
      id: "rowNumber",
      meta: { label: "№" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="№" />
      ),
      enableSorting: false,
      enableHiding: true,
      cell: ({ row, table }) => {
        const { pageIndex, pageSize } = table.getState().pagination;
        return (
          <span className="num text-muted-foreground">
            {(row.index + 1 + pageIndex * pageSize).toString()}
          </span>
        );
      },
    },
    {
      accessorKey: "createdAt",
      meta: { label: "Дата создания" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Дата создания" />
      ),
      enableSorting: true,
      cell: ({ getValue }) => (
        <span className="num text-muted-foreground">
          {formatDate(getValue<string>())}
        </span>
      ),
    },
    {
      accessorKey: "amountInBase",
      meta: { label: "Итого (баз.)" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Итого (баз.)" />
      ),
      enableSorting: true,
      cell: ({ row }) => (
        <div className="num text-right">
          {formatCurrency(
            row.original.amountInBase,
            row.original.baseCurrencyCode,
          )}
        </div>
      ),
    },
    {
      accessorKey: "feePercentage",
      meta: { label: "Комиссия (%)" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Комиссия (%)" />
      ),
      enableSorting: false,
      cell: ({ getValue }) => {
        const value = getValue<number>();
        return (
          <div className="num text-right">
            {Number.isFinite(value) ? `${value}%` : "—"}
          </div>
        );
      },
    },
    {
      accessorKey: "currency",
      meta: { label: "Валюта" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Валюта" />
      ),
      enableSorting: false,
      cell: ({ getValue }) => (
        <span className="num">{getValue<string>()}</span>
      ),
      filterFn: (row, id, filterValues) => {
        const v = row.getValue<CurrencyCode>(id);
        return Array.isArray(filterValues) ? filterValues.includes(v) : true;
      },
    },
    {
      accessorKey: "agentName",
      meta: { label: "Агент (имя)" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Агент (имя)" />
      ),
      enableSorting: true,
      cell: ({ getValue }) => {
        const name = getValue<string>();
        return (
          <span className="text-muted-foreground">{name || "—"}</span>
        );
      },
    },
    {
      accessorKey: "closedAt",
      meta: { label: "Дата закрытия" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Дата закрытия" />
      ),
      enableSorting: true,
      cell: ({ getValue }) => {
        const value = getValue<string | null>();
        return (
          <span className="num text-muted-foreground">
            {value ? formatDate(value) : "—"}
          </span>
        );
      },
    },
    {
      accessorKey: "comment",
      meta: { label: "Комментарий" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Комментарий" />
      ),
      enableSorting: false,
      cell: ({ getValue }) => (
        <span className="text-muted-foreground">
          {getValue<string>() || ""}
        </span>
      ),
    },
  ];

  return columns;
}

/**
 * Возвращает видимость колонок по умолчанию.
 * Визуально показываются 8 колонок (как в референсе); legacy — скрыты,
 * но включаются через DataTableViewOptions.
 */
export function getDefaultColumnVisibility(_isAdmin: boolean) {
  void _isAdmin;
  return {
    // visible
    id: true,
    client: true,
    amount: true,
    feeAbsolute: true,
    netMargin: true,
    status: true,
    dueDate: true,
    ownerAvatar: true,
    // legacy — hidden
    rowNumber: false,
    createdAt: false,
    amountInBase: false,
    feePercentage: false,
    currency: false,
    agentName: false,
    closedAt: false,
    comment: false,
  };
}
