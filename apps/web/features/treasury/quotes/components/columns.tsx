"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@bedrock/sdk-ui/components/badge";

import { DataTableColumnHeader } from "@/components/data-table/column-header";
import {
  type FxQuoteListRow,
  getFxQuotePricingModeLabel,
} from "@/features/treasury/quotes/lib/presentation";
import { buildTreasuryQuoteDetailsHref } from "@/features/treasury/quotes/lib/routes";
import { formatDate } from "@/lib/format";

export const columns: ColumnDef<FxQuoteListRow>[] = [
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
        <Link
          className="font-medium hover:underline"
          href={buildTreasuryQuoteDetailsHref(row.original.id)}
        >
          {row.original.fromCurrency}/{row.original.toCurrency}
        </Link>
        <div className="text-muted-foreground text-xs">
          {row.original.fromAmount} {row.original.fromCurrency} {"->"}{" "}
          {row.original.toAmount} {row.original.toCurrency}
        </div>
      </div>
    ),
    enableSorting: false,
  },
  {
    id: "stage",
    accessorFn: (row) => row.stage.badgeLabel,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Этап FX" />
    ),
    cell: ({ row }) => {
      const stage = row.original.stage;

      return (
        <div className="min-w-0 space-y-1">
          <Badge variant={stage.badgeVariant}>{stage.badgeLabel}</Badge>
          <div className="text-sm font-medium break-words">{stage.title}</div>
          {row.original.linkedArtifact ? (
            <Link
              className="text-muted-foreground text-xs hover:underline"
              href={row.original.linkedArtifact.href}
              onClick={(event) => event.stopPropagation()}
            >
              {row.original.linkedArtifact.label}
            </Link>
          ) : (
            <div className="text-muted-foreground text-xs break-words">
              {stage.contextLabel}
            </div>
          )}
        </div>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "pricingMode",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Модель" />
    ),
    cell: ({ row }) => (
      <Badge variant="outline">
        {getFxQuotePricingModeLabel(row.original.pricingMode)}
      </Badge>
    ),
    meta: {
      label: "Модель",
      variant: "multiSelect",
      options: [
        { label: "Автоматический маршрут", value: "auto_cross" },
        { label: "Явный маршрут", value: "explicit_route" },
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
    cell: ({ row }) => <span>{row.original.status}</span>,
    meta: {
      label: "Статус quote",
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
