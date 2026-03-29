"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/data-table/DataTableColumnHeader";
import type {
  ApplicationsRow,
  ApplicationStatus,
  CurrencyCode,
} from "@/lib/hooks/useApplicationsTable";
import {
  formatCurrency,
  formatDate,
} from "@/lib/utils/currency";

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
    colorClass: "bg-red-100 text-red-800",
  },
  TRY: {
    value: "TRY",
    label: "TRY",
    colorClass: "bg-orange-100 text-orange-800",
  },
  AED: {
    value: "AED",
    label: "AED",
    colorClass: "bg-amber-100 text-amber-800",
  },
};

export const CALCULATION_OPTIONS: Record<
  "yes" | "no",
  { value: "yes" | "no"; label: string; colorClass: string }
> = {
  yes: {
    value: "yes",
    label: "Создан",
    colorClass: "bg-emerald-100 text-emerald-800",
  },
  no: {
    value: "no",
    label: "Отсутствует",
    colorClass: "bg-rose-100 text-rose-800",
  },
};

export const STATUS_OPTIONS: Record<
  ApplicationStatus,
  { value: ApplicationStatus; label: string; colorClass: string }
> = {
  forming: {
    value: "forming",
    label: "Формируется",
    colorClass: "bg-gray-100 text-gray-800",
  },
  created: {
    value: "created",
    label: "Создана",
    colorClass: "bg-blue-100 text-blue-800",
  },
  rejected: {
    value: "rejected",
    label: "Отклонена",
    colorClass: "bg-red-100 text-red-800",
  },
  finished: {
    value: "finished",
    label: "Завершена",
    colorClass: "bg-green-100 text-green-800",
  },
};

export interface ApplicationsColumnsOptions {
  isAdmin: boolean;
}

/**
 * Создаёт колонки для таблицы заявок.
 * Используется как на странице /applications, так и на странице /reports.
 */
export function createApplicationsColumns(
  options: ApplicationsColumnsOptions
): ColumnDef<ApplicationsRow, unknown>[] {
  const { isAdmin } = options;

  const columns: ColumnDef<ApplicationsRow, unknown>[] = [
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
      meta: { label: "№ заявки" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="№ заявки" />
      ),
      enableSorting: true,
      cell: ({ getValue }) => `#${getValue<number>()}`,
    },
    {
      accessorKey: "createdAt",
      meta: { label: "Дата" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Дата" />
      ),
      enableSorting: true,
      cell: ({ getValue }) => formatDate(getValue<string>()),
    },
    {
      accessorKey: "client",
      meta: { label: "Заказчик" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Заказчик" />
      ),
      enableSorting: true,
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
      id: "hasCalculation",
      meta: { label: "Расчёт" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Расчёт" />
      ),
      enableSorting: false,
      cell: ({ row }) =>
        row.original.hasCalculation ? "Создан" : "Отсутствует",
      filterFn: (row, _id, filterValues) => {
        if (!Array.isArray(filterValues) || filterValues.length === 0)
          return true;
        const mapped = row.original.hasCalculation ? "yes" : "no";
        return filterValues.includes(mapped);
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
        const status = getValue<ApplicationStatus>();
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
        const v = row.getValue<ApplicationStatus>(id);
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
      cell: ({ getValue }) => {
        const agentName = getValue<string>();
        if (!agentName || agentName === "—") {
          return (
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
              Не назначен
            </span>
          );
        }
        return agentName;
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
  };
}
