"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { Currency } from "@bedrock/currencies";

import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { formatDate } from "@/lib/format";

export const columns: ColumnDef<Currency>[] = [
  {
    accessorKey: "code",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Код" />
    ),
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "name",
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
    accessorKey: "symbol",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Символ" />
    ),
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "precision",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Точность" />
    ),
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Создана" />
    ),
    cell: ({ row }) => formatDate(row.getValue("createdAt")),
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "updatedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Обновлена" />
    ),
    cell: ({ row }) => formatDate(row.getValue("updatedAt")),
    enableSorting: true,
    enableHiding: true,
  },
];
