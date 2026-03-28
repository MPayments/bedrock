"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/data-table/column-header";

import type { TreasuryExceptionTableRow } from "../lib/presentation";
import { MatchExternalRecordDialog } from "./match-external-record-dialog";

export function getTreasuryUnmatchedRecordsTableColumns(input: {
  assetLabels: Record<string, string>;
  instructions: Parameters<typeof MatchExternalRecordDialog>[0]["instructions"];
  operations: Parameters<typeof MatchExternalRecordDialog>[0]["operations"];
}) {
  const columns: ColumnDef<TreasuryExceptionTableRow>[] = [
    {
      id: "query",
      accessorFn: (row) =>
        [
          row.sourceLabel,
          row.recordKindLabel,
          row.reasonLabel,
          row.reasonMetaLabel ?? "",
          row.resolutionHint,
          row.externalRecordId,
          row.externalRecordShortId,
        ]
          .filter((value) => value.length > 0)
          .join(" "),
      header: () => null,
      cell: () => null,
      meta: {
        label: "Поиск",
        variant: "text",
        placeholder: "Поиск по источнику, сигналу или причине...",
      },
      enableColumnFilter: true,
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "receivedAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Когда пришло" />
      ),
      cell: ({ row }) => (
        <div className="w-28 text-muted-foreground text-sm">
          {row.original.receivedAtLabel}
        </div>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "sourceLabel",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Источник" />
      ),
      enableSorting: true,
    },
    {
      id: "signal",
      accessorFn: (row) => `${row.recordKindLabel} ${row.externalRecordShortId}`,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Что пришло" />
      ),
      cell: ({ row }) => (
        <div className="space-y-1">
          <div>{row.original.recordKindLabel}</div>
          <div className="text-muted-foreground font-mono text-xs">
            {row.original.externalRecordShortId}
          </div>
        </div>
      ),
      enableSorting: false,
    },
    {
      id: "issue",
      accessorFn: (row) => `${row.reasonLabel} ${row.reasonMetaLabel ?? ""}`,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Почему не закрыто" />
      ),
      cell: ({ row }) => (
        <div className="space-y-1">
          <div>{row.original.reasonLabel}</div>
          {row.original.reasonMetaLabel ? (
            <div className="text-muted-foreground max-w-[20rem] truncate text-xs">
              {row.original.reasonMetaLabel}
            </div>
          ) : null}
        </div>
      ),
      enableSorting: false,
    },
    {
      accessorKey: "resolutionHint",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Что делать" />
      ),
      cell: ({ row }) => (
        <div className="max-w-[24rem] text-muted-foreground text-sm leading-6">
          {row.original.resolutionHint}
        </div>
      ),
      enableSorting: false,
    },
    {
      id: "action",
      header: () => <div className="text-right">Действие</div>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <MatchExternalRecordDialog
            assetLabels={input.assetLabels}
            instructions={input.instructions}
            operations={input.operations}
            record={row.original.record}
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },
  ];

  return columns;
}
