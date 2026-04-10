"use client";

import { ColumnDef } from "@tanstack/react-table";
import { formatCompactId } from "@bedrock/shared/core/uuid";

import { DataTableColumnHeader } from "@bedrock/sdk-tables-ui/components/data-table-column-header";
import type { Option } from "@bedrock/sdk-tables-ui/lib/types";
import type {
  DealsRow,
  DealStatus,
  CurrencyCode,
} from "@/lib/hooks/useDealsTable";
import { formatCurrency, formatDate } from "@/lib/utils/currency";

// Re-export for backward compat
export { formatCurrency, formatDate };

// Опции для фильтров (Option[] format)
export const CURRENCY_OPTIONS: Option[] = [
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
  { value: "RUB", label: "RUB" },
  { value: "CNY", label: "CNY" },
  { value: "TRY", label: "TRY" },
  { value: "AED", label: "AED" },
];

export const STATUS_OPTIONS: Option[] = [
  { value: "draft", label: "Черновик" },
  { value: "submitted", label: "Отправлена" },
  { value: "rejected", label: "Отклонена" },
  { value: "preparing_documents", label: "Подготовка документов" },
  { value: "awaiting_funds", label: "Ожидание средств" },
  { value: "awaiting_payment", label: "Ожидание оплаты" },
  { value: "closing_documents", label: "Закрывающие документы" },
  { value: "done", label: "Завершена" },
  { value: "cancelled", label: "Отменена" },
];

// Lookup map for cell rendering (status badge colors)
const STATUS_DISPLAY: Record<DealStatus, { label: string; colorClass: string }> = {
  draft: { label: "Черновик", colorClass: "bg-slate-100 text-slate-800" },
  submitted: { label: "Отправлена", colorClass: "bg-sky-100 text-sky-800" },
  rejected: { label: "Отклонена", colorClass: "bg-rose-100 text-rose-800" },
  preparing_documents: { label: "Подготовка документов", colorClass: "bg-gray-100 text-gray-800" },
  awaiting_funds: { label: "Ожидание средств", colorClass: "bg-blue-100 text-blue-800" },
  awaiting_payment: { label: "Ожидание оплаты", colorClass: "bg-yellow-100 text-yellow-800" },
  closing_documents: { label: "Закрывающие документы", colorClass: "bg-orange-100 text-orange-800" },
  done: { label: "Завершена", colorClass: "bg-green-100 text-green-800" },
  cancelled: { label: "Отменена", colorClass: "bg-red-100 text-red-800" },
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
        <DataTableColumnHeader column={column} label="№" />
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
        <DataTableColumnHeader column={column} label="№ сделки" />
      ),
      enableSorting: true,
      cell: ({ getValue }) => `#${formatCompactId(getValue<string>())}`,
    },
    {
      accessorKey: "createdAt",
      meta: { label: "Дата создания" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Дата создания" />
      ),
      enableSorting: true,
      cell: ({ getValue }) => formatDate(getValue<string>()),
    },
    {
      accessorKey: "client",
      meta: { label: "Клиент" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Клиент" />
      ),
      enableSorting: true,
      cell: ({ getValue }) => getValue<string>() || "—",
    },
    {
      id: "amountInCurrency",
      accessorKey: "amount",
      meta: { label: "Сумма (валюта)" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Сумма (валюта)" />
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
        <DataTableColumnHeader column={column} label="Итого (баз.)" />
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
        <DataTableColumnHeader column={column} label="Комиссия (%)" />
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
        <DataTableColumnHeader column={column} label="Валюта" />
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
        <DataTableColumnHeader column={column} label="Статус" />
      ),
      enableSorting: false,
      cell: ({ getValue }) => {
        const status = getValue<DealStatus>();
        const display = STATUS_DISPLAY[status];
        return (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${display.colorClass}`}
          >
            {display.label}
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
        <DataTableColumnHeader column={column} label="Агент" />
      ),
      enableSorting: true,
      cell: ({ getValue }) => getValue<string>() || "—",
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
        return value ? formatDate(value) : "—";
      },
    },
    {
      accessorKey: "comment",
      meta: { label: "Комментарий" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Комментарий" />
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
