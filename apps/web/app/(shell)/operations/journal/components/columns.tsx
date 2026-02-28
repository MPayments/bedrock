"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@bedrock/ui/components/badge";

import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { formatDate } from "@/lib/format";
import type { OperationSummaryDto } from "../lib/queries";
import { getOperationCodeLabel } from "../lib/operation-code-labels";

const STATUS_FILTER_OPTIONS = [
  { label: "В обработке", value: "pending" },
  { label: "Проведено", value: "posted" },
  { label: "Ошибка", value: "failed" },
];

function statusMeta(status: OperationSummaryDto["status"]) {
  if (status === "posted") {
    return { label: "Проведено", variant: "default" as const };
  }
  if (status === "pending") {
    return { label: "В обработке", variant: "secondary" as const };
  }
  return { label: "Ошибка", variant: "destructive" as const };
}

export function getColumns(): ColumnDef<OperationSummaryDto>[] {
  return [
    {
      id: "query",
      accessorFn: (row) =>
        [
          row.id,
          row.sourceType,
          row.sourceId,
          row.operationCode,
          row.bookIds.join(" "),
          row.currencies.join(" "),
          row.error ?? "",
        ]
          .filter((value) => value.length > 0)
          .join(" "),
      header: () => null,
      cell: () => null,
      meta: {
        label: "Поиск",
        variant: "text",
        placeholder: "Поиск по ID, источнику, коду операции...",
      },
      enableColumnFilter: true,
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "sourceId",
      header: () => null,
      cell: () => null,
      meta: {
        label: "ID источника",
        variant: "text",
        placeholder: "UUID источника",
      },
      enableColumnFilter: true,
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "bookId",
      accessorFn: (row) => row.bookIds.join(","),
      header: () => null,
      cell: () => null,
      meta: {
        label: "ID book",
        variant: "text",
        placeholder: "UUID book",
      },
      enableColumnFilter: true,
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "source",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Источник" />
      ),
      cell: ({ row }) => (
        <div className="text-sm">
          <div>{row.original.sourceType}</div>
          <div className="text-muted-foreground font-mono text-xs">
            {row.original.sourceId}
          </div>
        </div>
      ),
      enableSorting: false,
      enableHiding: true,
    },
    {
      accessorKey: "operationCode",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Код" />
      ),
      cell: ({ row }) => (
        <div title={row.original.operationCode}>
          {getOperationCodeLabel(row.original.operationCode)}
        </div>
      ),
      enableSorting: false,
      enableHiding: true,
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Статус" />
      ),
      cell: ({ row }) => {
        const status = statusMeta(row.original.status);
        return <Badge variant={status.variant}>{status.label}</Badge>;
      },
      meta: {
        label: "Статус",
        variant: "multiSelect",
        options: STATUS_FILTER_OPTIONS,
      },
      enableColumnFilter: true,
      enableSorting: false,
      enableHiding: true,
    },
    {
      accessorKey: "postingCount",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Проводки" />
      ),
      cell: ({ row }) => (
        <div className="text-right">{row.original.postingCount}</div>
      ),
      enableSorting: false,
      enableHiding: true,
    },
    {
      id: "currencies",
      accessorFn: (row) => row.currencies.join(", "),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Валюты" />
      ),
      cell: ({ row }) => row.original.currencies.join(", ") || "—",
      enableSorting: false,
      enableHiding: true,
    },
    {
      accessorKey: "postingDate",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Дата проводки" />
      ),
      cell: ({ row }) => (
        <div className="text-xs">{formatDate(row.original.postingDate)}</div>
      ),
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: "postedAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Проведена" />
      ),
      cell: ({ row }) =>
        row.original.postedAt ? (
          <div className="text-xs">{formatDate(row.original.postedAt)}</div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      enableSorting: true,
      enableHiding: true,
    },
  ];
}
