"use client";

import { ColumnDef } from "@tanstack/react-table";
import { formatCompactId } from "@bedrock/shared/core/uuid";

import { DataTableColumnHeader } from "@/components/data-table/DataTableColumnHeader";
import type {
  DealsRow,
  DealStatus,
  CurrencyCode,
} from "@/lib/hooks/useDealsTable";
import { formatCurrency, formatDate } from "@/lib/utils/currency";

// Re-export for backward compat
export { formatCurrency, formatDate };

// Опции для фильтров
export const CURRENCY_OPTIONS: Record<
  CurrencyCode,
  { value: CurrencyCode; label: string; colorClass: string }
> = {
  USD: { value: "USD", label: "USD", colorClass: "bg-blue-100 text-blue-800" },
  EUR: {
    value: "EUR",
    label: "EUR",
    colorClass: "bg-indigo-100 text-indigo-800",
  },
  RUB: {
    value: "RUB",
    label: "RUB",
    colorClass: "bg-green-100 text-green-800",
  },
  CNY: {
    value: "CNY",
    label: "CNY",
    colorClass: "bg-yellow-100 text-yellow-800",
  },
  TRY: {
    value: "TRY",
    label: "TRY",
    colorClass: "bg-red-100 text-red-800",
  },
  AED: {
    value: "AED",
    label: "AED",
    colorClass: "bg-purple-100 text-purple-800",
  },
};

export const STATUS_OPTIONS: Record<
  DealStatus,
  { value: DealStatus; label: string; colorClass: string }
> = {
  draft: {
    value: "draft",
    label: "Черновик",
    colorClass: "bg-slate-100 text-slate-800",
  },
  submitted: {
    value: "submitted",
    label: "Отправлена",
    colorClass: "bg-sky-100 text-sky-800",
  },
  rejected: {
    value: "rejected",
    label: "Отклонена",
    colorClass: "bg-rose-100 text-rose-800",
  },
  preparing_documents: {
    value: "preparing_documents",
    label: "Подготовка документов",
    colorClass: "bg-gray-100 text-gray-800",
  },
  awaiting_funds: {
    value: "awaiting_funds",
    label: "Ожидание средств",
    colorClass: "bg-blue-100 text-blue-800",
  },
  awaiting_payment: {
    value: "awaiting_payment",
    label: "Ожидание оплаты",
    colorClass: "bg-yellow-100 text-yellow-800",
  },
  closing_documents: {
    value: "closing_documents",
    label: "Закрывающие документы",
    colorClass: "bg-orange-100 text-orange-800",
  },
  done: {
    value: "done",
    label: "Завершена",
    colorClass: "bg-green-100 text-green-800",
  },
  cancelled: {
    value: "cancelled",
    label: "Отменена",
    colorClass: "bg-red-100 text-red-800",
  },
};

export interface DealsColumnsOptions {
  isAdmin: boolean;
}

/**
 * Создаёт колонки для таблицы сделок.
 * Используется на странице /reports/deals.
 */
export function createDealsColumns(): ColumnDef<DealsRow, unknown>[] {
  const columns: ColumnDef<DealsRow, unknown>[] = [
    {
      id: "rowNumber",
      meta: { label: "№" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="№" align="left" />
      ),
      enableSorting: false,
      enableHiding: false,
      cell: ({ row, table }) => {
        const { pageIndex, pageSize } = table.getState().pagination;
        return (row.index + 1 + pageIndex * pageSize).toString();
      },
    },
    {
      accessorKey: "id",
      meta: { label: "№ сделки" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="№ сделки" />
      ),
      enableSorting: true,
      cell: ({ getValue }) => `#${formatCompactId(getValue<string>())}`,
    },
    {
      accessorKey: "createdAt",
      meta: { label: "Дата создания" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Дата создания" />
      ),
      enableSorting: true,
      cell: ({ getValue }) => formatDate(getValue<string>()),
    },
    {
      accessorKey: "client",
      meta: { label: "Клиент" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Клиент" />
      ),
      enableSorting: true,
      cell: ({ getValue }) => getValue<string>() || "—",
    },
    {
      id: "amountInCurrency",
      accessorKey: "amount",
      meta: { label: "Сумма (валюта)" },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Сумма (валюта)"
          align="right"
        />
      ),
      enableSorting: true,
      cell: ({ row }) => (
        <div className="text-right">
          {formatCurrency(row.original.amount, row.original.currency)}
        </div>
      ),
    },
    {
      accessorKey: "amountInBase",
      meta: { label: "Итого (баз.)" },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Итого (баз.)"
          align="right"
        />
      ),
      enableSorting: true,
      cell: ({ row }) => {
        const baseCurrency = row.original.baseCurrencyCode;
        const amount = row.original.amountInBase;
        return (
          <div className="text-right">
            {formatCurrency(amount, baseCurrency)}
          </div>
        );
      },
    },
    {
      accessorKey: "feePercentage",
      meta: { label: "Комиссия (%)" },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Комиссия (%)"
          align="right"
        />
      ),
      enableSorting: false,
      cell: ({ getValue }) => {
        const value = getValue<number>();
        return (
          <div className="text-right">
            {Number.isFinite(value) ? `${value}%` : "—"}
          </div>
        );
      },
    },
    {
      accessorKey: "currency",
      meta: { label: "Валюта" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Валюта" />
      ),
      enableSorting: false,
      cell: ({ getValue }) => getValue<string>(),
      filterFn: (row, id, filterValues) => {
        const v = row.getValue<CurrencyCode>(id);
        return Array.isArray(filterValues) ? filterValues.includes(v) : true;
      },
    },
    {
      accessorKey: "status",
      meta: { label: "Статус" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Статус" />
      ),
      enableSorting: false,
      cell: ({ getValue }) => {
        const status = getValue<DealStatus>();
        const option = STATUS_OPTIONS[status];
        return (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${option.colorClass}`}
          >
            {option.label}
          </span>
        );
      },
      filterFn: (row, id, filterValues) => {
        const v = row.getValue<DealStatus>(id);
        return Array.isArray(filterValues) ? filterValues.includes(v) : true;
      },
    },
    {
      accessorKey: "agentName",
      meta: { label: "Агент" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Агент" />
      ),
      enableSorting: true,
      cell: ({ getValue }) => getValue<string>() || "—",
    },
    {
      accessorKey: "closedAt",
      meta: { label: "Дата закрытия" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Дата закрытия" />
      ),
      enableSorting: true,
      cell: ({ getValue }) => {
        const value = getValue<string | null>();
        return value ? formatDate(value) : "—";
      },
    },
    {
      accessorKey: "comment",
      meta: { label: "Комментарий" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Комментарий" />
      ),
      enableSorting: false,
    },
  ];

  return columns;
}

/**
 * Возвращает видимость колонок по умолчанию.
 */
export function getDefaultColumnVisibility(isAdmin: boolean) {
  return {
    currency: false, // скрываем колонку валюты, т.к. она есть в сумме
    agentName: isAdmin, // показываем колонку агента только для админов
    closedAt: false, // скрываем дату закрытия по умолчанию
    amountInRub: false, // скрываем колонку суммы в рублях по умолчанию
    amountInCurrency: false, // скрываем колонку суммы в валюте по умолчанию
  };
}
