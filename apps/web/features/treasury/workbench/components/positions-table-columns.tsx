"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@bedrock/sdk-ui/components/badge";

import { DataTableColumnHeader } from "@/components/data-table/column-header";

import type { TreasuryPositionTableRow } from "../lib/presentation";
import { SettlePositionDialog } from "./settle-position-dialog";

const POSITION_KIND_FILTER_OPTIONS = [
  { label: "Обязательство перед клиентом", value: "customer_liability" },
  { label: "Требование к компании группы", value: "intercompany_due_from" },
  { label: "Обязательство перед компанией группы", value: "intercompany_due_to" },
];

const POSITION_STATUS_FILTER_OPTIONS = [
  { label: "Открыта", value: "open" },
  { label: "Закрыта", value: "closed" },
];

export const treasuryPositionsTableColumns: ColumnDef<TreasuryPositionTableRow>[] =
  [
    {
      id: "query",
      accessorFn: (row) =>
        [
          row.id,
          row.kindLabel,
          row.meaning,
          row.ownerLabel,
          row.relatedPartyLabel,
          row.statusLabel,
        ]
          .filter((value) => value.length > 0)
          .join(" "),
      header: () => null,
      cell: () => null,
      meta: {
        label: "Поиск",
        variant: "text",
        placeholder: "Поиск по типу, владельцу или стороне...",
      },
      enableColumnFilter: true,
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "kind",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Тип позиции" />
      ),
      cell: ({ row }) => (
        <div className="space-y-1">
          <Badge variant="outline">{row.original.kindLabel}</Badge>
          <div className="text-muted-foreground max-w-[18rem] text-xs leading-5">
            {row.original.meaning}
          </div>
        </div>
      ),
      meta: {
        label: "Тип позиции",
        variant: "multiSelect",
        options: POSITION_KIND_FILTER_OPTIONS,
      },
      enableColumnFilter: true,
      enableSorting: true,
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
      id: "relatedParty",
      accessorFn: (row) =>
        `${row.relatedPartyLabel} ${row.beneficialOwnerTypeLabel}`,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Кому относится" />
      ),
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="max-w-[14rem] truncate" title={row.original.relatedPartyLabel}>
            {row.original.relatedPartyLabel}
          </div>
          <div className="text-muted-foreground text-xs">
            {row.original.beneficialOwnerTypeLabel}
          </div>
        </div>
      ),
      enableSorting: false,
    },
    {
      id: "remaining",
      accessorFn: (row) => row.remainingLabel,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Остаток" />
      ),
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="font-medium">{row.original.remainingLabel}</div>
          <div className="text-muted-foreground text-xs">
            Из {row.original.amountLabel}
          </div>
        </div>
      ),
      enableSorting: false,
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Статус" />
      ),
      cell: ({ row }) => (
        <Badge variant={row.original.canSettle ? "default" : "secondary"}>
          {row.original.statusLabel}
        </Badge>
      ),
      meta: {
        label: "Статус",
        variant: "multiSelect",
        options: POSITION_STATUS_FILTER_OPTIONS,
      },
      enableColumnFilter: true,
      enableSorting: true,
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
    {
      id: "action",
      header: () => <div className="text-right">Действие</div>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          {row.original.canSettle ? (
            <SettlePositionDialog
              position={{
                assetCode: row.original.assetCode,
                id: row.original.id,
                kindLabel: row.original.kindLabel,
                meaning: row.original.meaning,
                ownerLabel: row.original.ownerLabel,
                relatedPartyLabel: row.original.relatedPartyLabel,
                remainingLabel: row.original.remainingLabel,
                remainingMinor: row.original.remainingMinor,
              }}
              triggerSize="sm"
              triggerVariant="outline"
            >
              Погасить
            </SettlePositionDialog>
          ) : (
            <span className="text-muted-foreground text-sm">Закрыта</span>
          )}
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },
  ];
