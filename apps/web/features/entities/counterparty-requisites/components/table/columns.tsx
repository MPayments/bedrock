"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/data-table/column-header";
import {
  REQUISITE_KIND_FILTER_OPTIONS,
  type SerializedRequisite,
} from "@/features/entities/requisites-shared/lib/constants";
import { formatDate } from "@/lib/format";

import { CounterpartyRequisiteRowActions } from "../counterparty-requisite-row-actions";

export function getColumns(
  currencyFilterOptions: { value: string; label: string }[],
): ColumnDef<SerializedRequisite>[] {
  return [
    {
      accessorKey: "label",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Название" />
      ),
      meta: {
        label: "Название",
        variant: "text",
        placeholder: "Поиск по названию...",
      },
      enableColumnFilter: true,
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: "ownerDisplay",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Контрагент" />
      ),
      enableSorting: false,
      enableHiding: true,
    },
    {
      accessorKey: "kind",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Вид" />
      ),
      cell: ({ row }) => row.original.kindDisplay,
      meta: {
        label: "Вид",
        variant: "multiSelect",
        options: REQUISITE_KIND_FILTER_OPTIONS,
      },
      enableColumnFilter: true,
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: "currencyId",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Валюта" />
      ),
      cell: ({ row }) => row.original.currencyDisplay,
      meta: {
        label: "Валюта",
        variant: "multiSelect",
        options: currencyFilterOptions,
      },
      enableColumnFilter: true,
      enableSorting: false,
      enableHiding: true,
    },
    {
      accessorKey: "identity",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Идентификатор" />
      ),
      cell: ({ row }) => row.original.identity || "—",
      enableSorting: false,
      enableHiding: true,
    },
    {
      accessorKey: "updatedAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Обновлено" />
      ),
      cell: ({ row }) => formatDate(row.getValue("updatedAt")),
      enableSorting: true,
      enableHiding: true,
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <CounterpartyRequisiteRowActions requisite={row.original} />
      ),
      size: 48,
    },
  ];
}
