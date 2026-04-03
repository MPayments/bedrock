"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@bedrock/sdk-ui/components/badge";

import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { formatDate } from "@/lib/format";
import {
  formatDealNextAction,
  getFinanceDealStatusLabel,
  getFinanceDealStatusVariant,
  getFinanceDealTypeLabel,
} from "@/features/treasury/deals/labels";
import type { TreasuryOperationWorkspaceItem } from "@bedrock/treasury/contracts";
import { formatCompactId } from "@bedrock/shared/core/uuid";

import {
  getTreasuryOperationInstructionStatusLabel,
  getTreasuryOperationInstructionStatusVariant,
  getTreasuryOperationKindLabel,
  getTreasuryOperationKindOptions,
  getTreasuryOperationKindVariant,
} from "../lib/labels";

export const columns: ColumnDef<TreasuryOperationWorkspaceItem>[] = [
  {
    accessorKey: "kind",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Операция" />
    ),
    cell: ({ row }) => (
      <Badge variant={getTreasuryOperationKindVariant(row.original.kind)}>
        {getTreasuryOperationKindLabel(row.original.kind)}
      </Badge>
    ),
    meta: {
      label: "Операция",
      options: getTreasuryOperationKindOptions(),
      variant: "multiSelect",
    },
    enableColumnFilter: true,
    enableSorting: true,
  },
  {
    id: "amount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Сумма" />
    ),
    cell: ({ row }) => (
      <div className="space-y-1 text-sm">
        <div>{row.original.amount.formatted}</div>
        {row.original.counterAmount ? (
          <div className="text-xs text-muted-foreground">
            Контрсумма: {row.original.counterAmount.formatted}
          </div>
        ) : null}
      </div>
    ),
    enableSorting: false,
  },
  {
    id: "internalEntity",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Внутренняя организация" />
    ),
    cell: ({ row }) => row.original.internalEntity.name ?? "—",
    enableSorting: false,
  },
  {
    id: "accounts",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Источник / назначение" />
    ),
    cell: ({ row }) => (
      <div className="space-y-1 text-sm">
        <div>Из: {row.original.sourceAccount.label}</div>
        <div className="text-muted-foreground">
          В: {row.original.destinationAccount.label}
        </div>
      </div>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "providerRoute",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Провайдер / маршрут" />
    ),
    cell: ({ row }) => (
      <div className="max-w-60 text-sm text-foreground">
        {row.original.providerRoute}
      </div>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "instructionStatus",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Статус инструкции" />
    ),
    cell: ({ row }) => (
      <Badge
        variant={getTreasuryOperationInstructionStatusVariant(
          row.original.instructionStatus,
        )}
      >
        {getTreasuryOperationInstructionStatusLabel(
          row.original.instructionStatus,
        )}
      </Badge>
    ),
    enableSorting: false,
  },
  {
    id: "dealRef",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Сделка" />
    ),
    cell: ({ row }) => {
      const dealRef = row.original.dealRef;

      if (!dealRef) {
        return "—";
      }

      return (
        <div className="space-y-1 text-sm">
          <div>{dealRef.applicantName ?? `#${formatCompactId(dealRef.dealId)}`}</div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{getFinanceDealTypeLabel(dealRef.type)}</span>
            <Badge variant={getFinanceDealStatusVariant(dealRef.status)}>
              {getFinanceDealStatusLabel(dealRef.status)}
            </Badge>
          </div>
        </div>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "nextAction",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Следующий шаг" />
    ),
    cell: ({ row }) => (
      <div className="max-w-64 text-sm">
        {formatDealNextAction(row.original.nextAction)}
      </div>
    ),
    enableSorting: false,
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
