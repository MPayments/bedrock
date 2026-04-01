"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@bedrock/sdk-ui/components/badge";

import { DataTableColumnHeader } from "@/components/data-table/column-header";
import type { FxQuoteListItem } from "@/features/treasury/quotes/lib/queries";
import { formatDate } from "@/lib/format";

import { DealWorkflowDialog } from "./deal-workflow-dialog";

function getStatusLabel(status: FxQuoteListItem["status"]) {
  switch (status) {
    case "active":
      return "Активна";
    case "used":
      return "Использована";
    case "expired":
      return "Истекла";
    case "cancelled":
      return "Отменена";
  }
}

function getStatusVariant(
  status: FxQuoteListItem["status"],
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
      return "default";
    case "used":
      return "secondary";
    case "expired":
      return "destructive";
    case "cancelled":
      return "outline";
  }
}

function getPricingModeLabel(mode: FxQuoteListItem["pricingMode"]) {
  return mode === "auto_cross" ? "Auto cross" : "Explicit route";
}

function getDealTypeLabel(type: NonNullable<FxQuoteListItem["dealRef"]>["type"]) {
  switch (type) {
    case "payment":
      return "Платеж";
    case "currency_exchange":
      return "Обмен";
    case "currency_transit":
      return "Транзит";
    case "exporter_settlement":
      return "Экспортер";
  }
}

export const columns: ColumnDef<FxQuoteListItem>[] = [
  {
    accessorKey: "idempotencyKey",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Quote ref" />
    ),
    cell: ({ row }) => (
      <div className="space-y-1">
        <div className="font-mono text-xs">{row.original.idempotencyKey}</div>
        <div className="text-muted-foreground font-mono text-[11px]">
          {row.original.id.slice(0, 8)}
        </div>
      </div>
    ),
    meta: {
      label: "Quote ref",
      variant: "text",
      placeholder: "Поиск по quote ref...",
    },
    enableColumnFilter: true,
    enableSorting: false,
  },
  {
    id: "pair",
    accessorFn: (row) => `${row.fromCurrency}/${row.toCurrency}`,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Пара" />
    ),
    cell: ({ row }) => (
      <div className="space-y-1">
        <div className="font-medium">
          {row.original.fromCurrency}/{row.original.toCurrency}
        </div>
        <div className="text-muted-foreground text-xs">
          {row.original.fromAmount} {row.original.fromCurrency} {"->"}{" "}
          {row.original.toAmount} {row.original.toCurrency}
        </div>
      </div>
    ),
    enableSorting: false,
  },
  {
    id: "dealRef",
    accessorFn: (row) =>
      row.dealRef
        ? `${row.dealRef.type}:${row.dealRef.applicantName ?? row.dealRef.dealId}`
        : "",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Сделка" />
    ),
    cell: ({ row }) =>
      row.original.dealRef ? (
        <div className="space-y-1">
          <div className="font-medium">
            {getDealTypeLabel(row.original.dealRef.type)}
          </div>
          <div className="text-muted-foreground text-xs">
            {row.original.dealRef.applicantName ?? "Заявитель не указан"}
          </div>
          <div>
            <DealWorkflowDialog dealId={row.original.dealRef.dealId} />
          </div>
        </div>
      ) : (
        <span className="text-muted-foreground text-xs">-</span>
      ),
    enableSorting: false,
  },
  {
    accessorKey: "pricingMode",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Модель" />
    ),
    cell: ({ row }) => (
      <Badge variant="outline">
        {getPricingModeLabel(row.original.pricingMode)}
      </Badge>
    ),
    meta: {
      label: "Модель",
      variant: "multiSelect",
      options: [
        { label: "Auto cross", value: "auto_cross" },
        { label: "Explicit route", value: "explicit_route" },
      ],
    },
    enableColumnFilter: true,
    enableSorting: true,
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Статус" />
    ),
    cell: ({ row }) => (
      <Badge variant={getStatusVariant(row.original.status)}>
        {getStatusLabel(row.original.status)}
      </Badge>
    ),
    meta: {
      label: "Статус",
      variant: "multiSelect",
      options: [
        { label: "Активна", value: "active" },
        { label: "Использована", value: "used" },
        { label: "Истекла", value: "expired" },
        { label: "Отменена", value: "cancelled" },
      ],
    },
    enableColumnFilter: true,
    enableSorting: true,
  },
  {
    accessorKey: "usedByRef",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Использована в" />
    ),
    cell: ({ row }) =>
      row.original.usedByRef ? (
        <span className="font-mono text-xs">{row.original.usedByRef}</span>
      ) : (
        <span className="text-muted-foreground text-xs">-</span>
      ),
    enableSorting: false,
  },
  {
    accessorKey: "expiresAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Истекает" />
    ),
    cell: ({ row }) => formatDate(row.original.expiresAt),
    enableSorting: true,
  },
  {
    accessorKey: "usedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Использована" />
    ),
    cell: ({ row }) =>
      row.original.usedAt ? (
        formatDate(row.original.usedAt)
      ) : (
        <span className="text-muted-foreground text-xs">-</span>
      ),
    enableSorting: true,
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Создана" />
    ),
    cell: ({ row }) => formatDate(row.original.createdAt),
    enableSorting: true,
  },
];
