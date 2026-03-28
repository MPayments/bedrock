"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@bedrock/sdk-ui/components/badge";

import { DataTableColumnHeader } from "@/components/data-table/column-header";

import type { TreasuryOperationTableRow } from "../lib/presentation";

const OPERATION_KIND_FILTER_OPTIONS = [
  { label: "Выплата", value: "payout" },
  { label: "Поступление", value: "collection" },
  { label: "Внутренний перевод", value: "intracompany_transfer" },
  { label: "Внутригрупповое финансирование", value: "intercompany_funding" },
  { label: "Переброска ликвидности", value: "sweep" },
  { label: "Возврат", value: "return" },
  { label: "Корректировка", value: "adjustment" },
  { label: "Конверсия валюты", value: "fx_conversion" },
];

const STATUS_FILTER_OPTIONS = [
  { label: "Черновик", value: "draft" },
  { label: "Одобрено", value: "approved" },
  { label: "Зарезервировано", value: "reserved" },
  { label: "Отправлено", value: "submitted" },
  { label: "Частично исполнено", value: "partially_settled" },
  { label: "Исполнено", value: "settled" },
  { label: "Ошибка", value: "failed" },
  { label: "Возврат", value: "returned" },
  { label: "Аннулировано", value: "void" },
];

export const treasuryOperationsTableColumns: ColumnDef<TreasuryOperationTableRow>[] =
  [
    {
      id: "query",
      accessorFn: (row) =>
        [
          row.id,
          row.shortId,
          row.kindLabel,
          row.ownerLabel,
          row.routeLabel,
          row.nextStep,
          row.statusLabel,
        ]
          .filter((value) => value.length > 0)
          .join(" "),
      header: () => null,
      cell: () => null,
      meta: {
        label: "Поиск",
        variant: "text",
        placeholder: "Поиск по сценарию, владельцу, маршруту...",
      },
      enableColumnFilter: true,
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "kind",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Сценарий" />
      ),
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="font-medium">{row.original.kindLabel}</div>
          <div className="text-muted-foreground font-mono text-[11px]">
            {row.original.shortId}
          </div>
        </div>
      ),
      meta: {
        label: "Сценарий",
        variant: "multiSelect",
        options: OPERATION_KIND_FILTER_OPTIONS,
      },
      enableColumnFilter: true,
      enableSorting: true,
    },
    {
      accessorKey: "instructionStatus",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Этап" />
      ),
      cell: ({ row }) => (
        <div className="space-y-1">
          <Badge variant={row.original.statusVariant}>
            {row.original.statusLabel}
          </Badge>
          <div className="text-muted-foreground text-xs">
            {row.original.settlementModelLabel}
          </div>
        </div>
      ),
      meta: {
        label: "Этап",
        variant: "multiSelect",
        options: STATUS_FILTER_OPTIONS,
      },
      enableColumnFilter: true,
      enableSorting: true,
    },
    {
      accessorKey: "amountLabel",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Сумма" />
      ),
      cell: ({ row }) => <div className="font-medium">{row.original.amountLabel}</div>,
      enableSorting: false,
    },
    {
      accessorKey: "ownerLabel",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Владелец" />
      ),
      cell: ({ row }) => (
        <div className="max-w-[12rem] truncate" title={row.original.ownerLabel}>
          {row.original.ownerLabel}
        </div>
      ),
      enableSorting: true,
    },
    {
      id: "context",
      accessorFn: (row) => `${row.routeLabel} ${row.nextStep}`,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Маршрут и действие" />
      ),
      cell: ({ row }) => (
        <div className="max-w-[26rem] space-y-1">
          <div
            className="truncate text-sm leading-6"
            title={row.original.routeLabel}
          >
            {row.original.routeLabel}
          </div>
          <div
            className="text-muted-foreground truncate text-xs leading-5"
            title={row.original.nextStep}
          >
            {row.original.nextStep}
          </div>
        </div>
      ),
      enableSorting: false,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Создана" />
      ),
      cell: ({ row }) => (
        <div className="w-28 text-muted-foreground text-sm">
          {row.original.createdAtLabel}
        </div>
      ),
      enableSorting: true,
    },
  ];
