"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { DataTableColumnHeader } from "@bedrock/sdk-tables-ui/components/data-table-column-header";
import { formatCompactId } from "@bedrock/shared/core/uuid";

import { formatDate } from "@/lib/format";

import type { TreasuryOrderRow } from "../lib/queries";

export const TREASURY_ORDER_TYPE_LABELS: Record<TreasuryOrderRow["type"], string> = {
  fx_exchange: "Конверсия",
  liquidity_purchase: "Покупка ликвидности",
  pre_fund: "Пре-фондирование",
  rebalance: "Ребалансировка",
  single_payment: "Платёж",
};

export const TREASURY_ORDER_STATE_LABELS: Record<TreasuryOrderRow["state"], string> = {
  active: "Активен",
  cancelled: "Отменён",
  completed: "Завершён",
  draft: "Черновик",
  failed: "Ошибка",
};

function stateBadgeVariant(
  state: TreasuryOrderRow["state"],
): "default" | "destructive" | "outline" | "secondary" {
  switch (state) {
    case "completed":
      return "default";
    case "failed":
      return "destructive";
    case "cancelled":
      return "secondary";
    default:
      return "outline";
  }
}

function describeOrder(order: TreasuryOrderRow) {
  const [firstStep] = order.steps;
  if (!firstStep) return "Без шагов";
  const from = firstStep.fromAmountMinor ?? "—";
  const to = firstStep.toAmountMinor ?? "—";
  return `${from} → ${to}`;
}

export const orderColumns: ColumnDef<TreasuryOrderRow>[] = [
  {
    accessorKey: "type",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Тип ордера" />
    ),
    cell: ({ row }) => (
      <Badge variant="outline">
        {TREASURY_ORDER_TYPE_LABELS[row.original.type]}
      </Badge>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "state",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Статус" />
    ),
    cell: ({ row }) => (
      <Badge variant={stateBadgeVariant(row.original.state)}>
        {TREASURY_ORDER_STATE_LABELS[row.original.state]}
      </Badge>
    ),
    enableSorting: false,
  },
  {
    id: "steps",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Шаги" />
    ),
    cell: ({ row }) => (
      <span className="text-sm tabular-nums">{row.original.steps.length}</span>
    ),
    enableSorting: false,
  },
  {
    id: "description",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Описание" />
    ),
    cell: ({ row }) => (
      <div className="text-sm">
        <div>{row.original.description ?? describeOrder(row.original)}</div>
        <div className="text-muted-foreground text-xs">
          #{formatCompactId(row.original.id)}
        </div>
      </div>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "activatedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Активирован" />
    ),
    cell: ({ row }) =>
      row.original.activatedAt ? formatDate(row.original.activatedAt) : "—",
    enableSorting: true,
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Создан" />
    ),
    cell: ({ row }) => formatDate(row.original.createdAt),
    enableSorting: true,
  },
];
