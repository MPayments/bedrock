"use client";

import { useRouter } from "next/navigation";
import type { ColumnDef, Row as TanstackRow } from "@tanstack/react-table";
import * as React from "react";

import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { EntityTableShell } from "@/components/entities/entity-table-shell";
import { formatDate } from "@/lib/format";

import type { RequisitesListResult } from "../lib/types";
import type { SerializedRequisite } from "../../requisites-shared/lib/constants";

const columns: ColumnDef<SerializedRequisite>[] = [
  {
    accessorKey: "label",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Название" />
    ),
    enableSorting: true,
  },
  {
    accessorKey: "ownerDisplay",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Владелец" />
    ),
    enableSorting: true,
  },
  {
    accessorKey: "providerDisplay",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Провайдер" />
    ),
    enableSorting: true,
  },
  {
    accessorKey: "kind",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Вид" />
    ),
    cell: ({ row }) => row.original.kindDisplay,
    enableSorting: true,
  },
  {
    accessorKey: "currencyDisplay",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Валюта" />
    ),
    enableSorting: true,
  },
  {
    accessorKey: "identity",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Идентификатор" />
    ),
    cell: ({ row }) => row.original.identity || "—",
    enableSorting: false,
  },
  {
    accessorKey: "updatedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Обновлено" />
    ),
    cell: ({ row }) => formatDate(row.original.updatedAt),
    enableSorting: true,
  },
];

type RequisitesTableProps = {
  promise: Promise<RequisitesListResult>;
};

export function RequisitesTable({ promise }: RequisitesTableProps) {
  const router = useRouter();

  const handleRowDoubleClick = React.useCallback(
    (row: TanstackRow<SerializedRequisite>) => {
      router.push(`/entities/requisites/${row.original.id}`);
    },
    [router],
  );

  return (
    <EntityTableShell
      promise={promise}
      columns={columns}
      getRowId={(row) => row.id}
      initialState={{
        sorting: [{ id: "updatedAt", desc: true }],
      }}
      onRowDoubleClick={handleRowDoubleClick}
    />
  );
}
