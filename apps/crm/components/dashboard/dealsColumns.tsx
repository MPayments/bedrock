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
import { DEAL_STATUS_DISPLAY } from "@/lib/deal-status-display";
import { formatCurrency, formatDate } from "@/lib/utils/currency";

export const CURRENCY_OPTIONS: Option[] = [
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
  { value: "RUB", label: "RUB" },
  { value: "CNY", label: "CNY" },
  { value: "TRY", label: "TRY" },
  { value: "AED", label: "AED" },
];

export const STATUS_OPTIONS: Option[] = Object.entries(DEAL_STATUS_DISPLAY).map(
  ([value, { label }]) => ({ value, label }),
);

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
        const display = DEAL_STATUS_DISPLAY[status];
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
